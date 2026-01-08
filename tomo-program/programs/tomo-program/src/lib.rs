use anchor_lang::prelude::*;

declare_id!("GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM");

#[program]
pub mod tomo_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
