use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

declare_id!("GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM");

pub const TOMO_SEED: &[u8] = b"tomo";

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
        ctx.accounts.delegate_tomo(
            &ctx.accounts.payer,
            &[TOMO_SEED, uid.as_bytes()],
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
}

#[commit]
#[derive(Accounts)]
pub struct Undelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub tomo: Account<'info, Tomo>,
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
}

#[error_code]
pub enum TomoError {
    #[msg("Not enough coins to feed")]
    NotEnoughCoins,
}
