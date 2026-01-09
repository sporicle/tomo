use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use magicblock_magic_program_api::{args::ScheduleTaskArgs, instruction::MagicBlockInstruction};

declare_id!("GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM");

pub const TOMO_SEED: &[u8] = b"tomo1";

#[ephemeral]
#[program]
pub mod tomo_program {
    use super::*;

    pub fn init(ctx: Context<Init>, uid: String) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;
        tomo.owner = ctx.accounts.payer.key();
        tomo.uid = uid;
        tomo.hunger = 100;
        tomo.last_fed = Clock::get()?.unix_timestamp;
        tomo.coins = 0;
        tomo.item_drop = false;
        tomo.inventory = [0u8; 8];

        // Initialize crank_payer placeholder
        let crank_payer = &mut ctx.accounts.crank_payer;
        crank_payer.initialized = true;

        Ok(())
    }

    pub fn get_coin(ctx: Context<GetCoin>) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;
        tomo.coins += 1;
        Ok(())
    }

    pub fn feed(ctx: Context<Feed>) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;
        require!(tomo.coins >= 10, TomoError::NotEnoughCoins);
        tomo.coins -= 10;
        tomo.hunger = tomo.hunger.saturating_sub(30);
        tomo.last_fed = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Delegate the Tomo account to the ephemeral rollup
    pub fn delegate(ctx: Context<DelegateInput>, uid: String) -> Result<()> {
        // Delegate the tomo account
        ctx.accounts.delegate_tomo(
            &ctx.accounts.payer,
            &[TOMO_SEED, uid.as_bytes()],
            DelegateConfig::default(),
        )?;

        // Also delegate the crank_payer PDA so it can be used in the ER
        let tomo_key = ctx.accounts.tomo.key();
        ctx.accounts.delegate_crank_payer(
            &ctx.accounts.payer,
            &[b"crank_payer", tomo_key.as_ref()],
            DelegateConfig::default(),
        )?;

        Ok(())
    }

    /// Undelegate the Tomo account from the ephemeral rollup
    pub fn undelegate(ctx: Context<Undelegate>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.tomo.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    /// Delete the Tomo account, returning rent to the owner
    pub fn delete(_ctx: Context<Delete>) -> Result<()> {
        Ok(())
    }

    /// Trigger an item drop - sets item_drop to true if false
    pub fn trigger_item_drop(ctx: Context<TriggerItemDrop>) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;
        if !tomo.item_drop {
            tomo.item_drop = true;
        }
        Ok(())
    }

    /// Open an item drop - uses VRF to add a random item (1-5) to inventory
    /// Does nothing if inventory is full or no item drop is available
    pub fn open_item_drop(ctx: Context<OpenItemDrop>, client_seed: u8) -> Result<()> {
        let tomo = &ctx.accounts.tomo;

        // Check if there's an item drop available
        if !tomo.item_drop {
            msg!("No item drop available");
            return Ok(());
        }

        // Check if inventory has space (look for a 0 slot)
        let has_space = tomo.inventory.iter().any(|&item| item == 0);
        if !has_space {
            msg!("Inventory is full");
            return Ok(());
        }

        msg!("Requesting randomness for item drop...");
        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::ConsumeRandomness::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: ctx.accounts.tomo.key(),
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });

        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// VRF callback - receives randomness and adds item to inventory
    pub fn consume_randomness(ctx: Context<ConsumeRandomness>, randomness: [u8; 32]) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;

        // Set item_drop to false
        tomo.item_drop = false;

        // Find first empty slot (0) in inventory
        if let Some(slot) = tomo.inventory.iter().position(|&item| item == 0) {
            // Generate random item 1-5 using VRF SDK helper
            let random_item = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 1, 9);
            tomo.inventory[slot] = random_item;
            msg!("Added item {} to inventory slot {}", random_item, slot);
        } else {
            msg!("Inventory was full, no item added");
        }

        Ok(())
    }

    /// Use an item at a specific index - removes it from inventory
    /// Does nothing if the slot is empty (contains 0)
    pub fn use_item(ctx: Context<UseItem>, index: u8) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;

        // Validate index is within bounds
        if index >= 8 {
            msg!("Invalid inventory index");
            return Ok(());
        }

        let slot = index as usize;

        // Check if the slot has an item (not 0)
        if tomo.inventory[slot] == 0 {
            msg!("Slot {} is empty, nothing to use", slot);
            return Ok(());
        }

        // Use the item (set to 0)
        let used_item = tomo.inventory[slot];
        tomo.inventory[slot] = 0;
        msg!("Used item {} from slot {}", used_item, slot);

        Ok(())
    }

    /// Request a random event using VRF
    /// The callback will have a 20% chance to trigger an item drop
    pub fn random_event(ctx: Context<RandomEvent>, client_seed: u8) -> Result<()> {
        msg!("Requesting randomness for random event...");

        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::ConsumeRandomEvent::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: ctx.accounts.tomo.key(),
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });

        ctx.accounts.invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// VRF callback for random event - 20% chance to trigger item drop
    pub fn consume_random_event(ctx: Context<ConsumeRandomEvent>, randomness: [u8; 32]) -> Result<()> {
        let tomo = &mut ctx.accounts.tomo;

        // Generate random value 1-100 using VRF SDK helper
        let random_value = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 1, 100);
        msg!("Random event value: {}", random_value);

        // 20% chance (1-20 out of 1-100) to trigger item drop
        if random_value <= 20 {
            if !tomo.item_drop {
                tomo.item_drop = true;
                msg!("Item drop triggered by random event!");
            } else {
                msg!("Item drop already available, skipping");
            }
        } else {
            msg!("No event triggered (rolled {})", random_value);
        }

        Ok(())
    }

    /// Crank-safe random event - uses PDA as payer so no external signer needed
    pub fn random_event_crank(ctx: Context<RandomEventCrank>, client_seed: u8) -> Result<()> {
        msg!("Crank executing random event...");

        let tomo_key = ctx.accounts.tomo.key();
        let bump = ctx.bumps.crank_payer;

        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.crank_payer.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::ConsumeRandomEvent::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: ctx.accounts.tomo.key(),
                is_signer: false,
                is_writable: true,
            }]),
            ..Default::default()
        });

        // Sign with the PDA seeds
        let signer_seeds: &[&[&[u8]]] = &[&[b"crank_payer", tomo_key.as_ref(), &[bump]]];

        invoke_signed(
            &ix,
            &[
                ctx.accounts.crank_payer.to_account_info(),
                ctx.accounts.oracle_queue.to_account_info(),
                ctx.accounts.program_identity.to_account_info(),
                ctx.accounts.vrf_program.to_account_info(),
                ctx.accounts.slot_hashes.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        Ok(())
    }

    /// Start random events crank - schedules random_event_crank to run periodically
    pub fn start_random_events(ctx: Context<StartRandomEvents>, args: ScheduleCrankArgs) -> Result<()> {
        msg!("Scheduling random events crank...");

        // Derive the crank payer PDA
        let tomo_key = ctx.accounts.tomo.key();
        let (crank_payer, _bump) = Pubkey::find_program_address(
            &[b"crank_payer", tomo_key.as_ref()],
            &crate::ID,
        );

        // Derive program identity PDA
        let (program_identity, _) = Pubkey::find_program_address(&[b"identity"], &crate::ID);

        // Build the instruction to be executed by the crank (random_event_crank)
        // This instruction uses a PDA as payer, so no external signer needed
        let crank_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![
                AccountMeta::new(ctx.accounts.tomo.key(), false),
                AccountMeta::new(ctx.accounts.oracle_queue.key(), false),
                AccountMeta::new(crank_payer, false),
                AccountMeta::new_readonly(program_identity, false),
                AccountMeta::new_readonly(ephemeral_vrf_sdk::consts::VRF_PROGRAM_ID, false),
                AccountMeta::new_readonly(anchor_lang::solana_program::sysvar::slot_hashes::ID, false),
                AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
            ],
            data: anchor_lang::InstructionData::data(&crate::instruction::RandomEventCrank {
                client_seed: 42, // Fixed seed for crank calls
            }),
        };

        // Serialize the ScheduleTask instruction
        let ix_data = bincode::serialize(&MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
            task_id: args.task_id,
            execution_interval_millis: args.execution_interval_millis,
            iterations: args.iterations,
            instructions: vec![crank_ix],
        }))
        .map_err(|err| {
            msg!("ERROR: failed to serialize args {:?}", err);
            anchor_lang::solana_program::program_error::ProgramError::InvalidArgument
        })?;

        // Create CPI instruction to Magic Program - must include ALL accounts used by scheduled instruction
        let schedule_ix = Instruction::new_with_bytes(
            MAGIC_PROGRAM_ID,
            &ix_data,
            vec![
                AccountMeta::new(ctx.accounts.payer.key(), true),
                AccountMeta::new(ctx.accounts.tomo.key(), false),
                AccountMeta::new(ctx.accounts.oracle_queue.key(), false),
                AccountMeta::new(crank_payer, false),
                AccountMeta::new_readonly(program_identity, false),
                AccountMeta::new_readonly(ctx.accounts.vrf_program.key(), false),
                AccountMeta::new_readonly(ctx.accounts.slot_hashes.key(), false),
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
            ],
        );

        // Execute CPI to schedule the task
        invoke_signed(
            &schedule_ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.tomo.to_account_info(),
                ctx.accounts.oracle_queue.to_account_info(),
                ctx.accounts.crank_payer.to_account_info(),
                ctx.accounts.program_identity.to_account_info(),
                ctx.accounts.vrf_program.to_account_info(),
                ctx.accounts.slot_hashes.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[],
        )?;

        msg!("Random events crank scheduled successfully!");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(uid: String)]
pub struct Init<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Tomo::INIT_SPACE,
        seeds = [TOMO_SEED, uid.as_bytes()],
        bump
    )]
    pub tomo: Account<'info, Tomo>,
    /// Crank payer PDA - initialized alongside tomo so it can be delegated later
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CrankPayer::INIT_SPACE,
        seeds = [b"crank_payer", tomo.key().as_ref()],
        bump
    )]
    pub crank_payer: Account<'info, CrankPayer>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetCoin<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[derive(Accounts)]
pub struct Feed<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(uid: String)]
pub struct DelegateInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The Tomo PDA to delegate
    #[account(mut, del, seeds = [TOMO_SEED, uid.as_bytes()], bump)]
    pub tomo: AccountInfo<'info>,
    /// CHECK: The crank_payer PDA to delegate
    #[account(mut, del, seeds = [b"crank_payer", tomo.key().as_ref()], bump)]
    pub crank_payer: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct Undelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[derive(Accounts)]
pub struct Delete<'info> {
    #[account(
        mut,
        close = owner,
        has_one = owner,
    )]
    pub tomo: Account<'info, Tomo>,
    #[account(
        mut,
        close = owner,
        seeds = [b"crank_payer", tomo.key().as_ref()],
        bump
    )]
    pub crank_payer: Account<'info, CrankPayer>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct TriggerItemDrop<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[vrf]
#[derive(Accounts)]
pub struct OpenItemDrop<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
    /// CHECK: Oracle queue for VRF
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_EPHEMERAL_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    /// SECURITY: Validates callback is from VRF program
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[derive(Accounts)]
pub struct UseItem<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

#[vrf]
#[derive(Accounts)]
pub struct RandomEvent<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
    /// CHECK: Oracle queue for VRF
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_EPHEMERAL_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ConsumeRandomEvent<'info> {
    /// SECURITY: Validates callback is from VRF program
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
}

/// Accounts for crank-executed random event (no external signer needed)
#[derive(Accounts)]
pub struct RandomEventCrank<'info> {
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
    /// CHECK: Oracle queue for VRF
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_EPHEMERAL_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
    /// CHECK: PDA that acts as payer for VRF - derived from ["crank_payer", tomo.key()]
    #[account(
        mut,
        seeds = [b"crank_payer", tomo.key().as_ref()],
        bump
    )]
    pub crank_payer: AccountInfo<'info>,
    /// CHECK: Program identity PDA for VRF
    #[account(
        seeds = [b"identity"],
        bump
    )]
    pub program_identity: AccountInfo<'info>,
    /// CHECK: VRF program
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_ID)]
    pub vrf_program: AccountInfo<'info>,
    /// CHECK: Slot hashes sysvar
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartRandomEvents<'info> {
    /// CHECK: Magic program for crank scheduling
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Use AccountInfo to avoid Anchor re-serialization after CPI
    #[account(mut)]
    pub tomo: AccountInfo<'info>,
    /// CHECK: Oracle queue for VRF (needed for the scheduled random_event calls)
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_EPHEMERAL_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
    /// CHECK: PDA that acts as payer for VRF in crank calls
    #[account(
        mut,
        seeds = [b"crank_payer", tomo.key().as_ref()],
        bump
    )]
    pub crank_payer: AccountInfo<'info>,
    /// CHECK: Program identity PDA for VRF
    #[account(
        seeds = [b"identity"],
        bump
    )]
    pub program_identity: AccountInfo<'info>,
    /// CHECK: VRF program
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_ID)]
    pub vrf_program: AccountInfo<'info>,
    /// CHECK: Slot hashes sysvar
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

/// Arguments for scheduling a crank
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ScheduleCrankArgs {
    pub task_id: u64,
    pub execution_interval_millis: u64,
    pub iterations: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Tomo {
    pub owner: Pubkey,
    #[max_len(32)]
    pub uid: String,
    pub hunger: u8,
    pub last_fed: i64,
    pub coins: u64,
    pub item_drop: bool,
    pub inventory: [u8; 8],
}

/// Placeholder account for crank payer PDA - needs to exist to be delegated
#[account]
#[derive(InitSpace)]
pub struct CrankPayer {
    pub initialized: bool,
}

#[error_code]
pub enum TomoError {
    #[msg("Not enough coins to feed")]
    NotEnoughCoins,
}
