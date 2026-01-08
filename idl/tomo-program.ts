/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tomo_program.json`.
 */
export type TomoProgram = {
  address: 'GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM'
  metadata: {
    name: 'tomo_program'
    version: '0.1.0'
    spec: '0.1.0'
    description: 'Created with Anchor'
  }
  instructions: [
    {
      name: 'feed'
      discriminator: [46, 213, 237, 176, 190, 113, 182, 94]
      accounts: [
        {
          name: 'tomo'
          writable: true
        },
      ]
      args: []
    },
    {
      name: 'get_coin'
      discriminator: [199, 17, 222, 208, 64, 249, 76, 135]
      accounts: [
        {
          name: 'tomo'
          writable: true
        },
      ]
      args: []
    },
    {
      name: 'init'
      discriminator: [220, 59, 207, 236, 108, 250, 47, 100]
      accounts: [
        {
          name: 'tomo'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 111, 109, 111]
              },
              {
                kind: 'arg'
                path: 'uid'
              },
            ]
          }
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'system_program'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'uid'
          type: 'string'
        },
      ]
    },
  ]
  accounts: [
    {
      name: 'Tomo'
      discriminator: [104, 46, 161, 148, 136, 8, 66, 191]
    },
  ]
  errors: [
    {
      code: 6000
      name: 'NotEnoughCoins'
      msg: 'Not enough coins to feed'
    },
  ]
  types: [
    {
      name: 'Tomo'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'owner'
            type: 'pubkey'
          },
          {
            name: 'uid'
            type: 'string'
          },
          {
            name: 'hunger'
            type: 'u8'
          },
          {
            name: 'last_fed'
            type: 'i64'
          },
          {
            name: 'coins'
            type: 'u64'
          },
        ]
      }
    },
  ]
}
