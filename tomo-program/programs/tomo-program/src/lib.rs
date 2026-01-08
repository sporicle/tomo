use anchor_lang::prelude::*;

declare_id!("GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM");

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
}

#[derive(Accounts)]
#[instruction(uid: String)]
pub struct Init<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Tomo::INIT_SPACE,
        seeds = [b"tomo", uid.as_bytes()],
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
