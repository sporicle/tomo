/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tomo_program.json`.
 */
export type TomoProgram = {
  "address": "GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM",
  "metadata": {
    "name": "tomoProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "delegate",
      "docs": ["Delegate the Tomo account to the ephemeral rollup"],
      "discriminator": [90, 147, 75, 178, 85, 88, 4, 137],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferTomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [98, 117, 102, 102, 101, 114] },
              { "kind": "account", "path": "tomo" }
            ],
            "program": {
              "kind": "const",
              "value": [226, 127, 227, 97, 202, 182, 63, 229, 205, 191, 17, 155, 36, 155, 64, 81, 14, 121, 27, 23, 125, 75, 154, 185, 44, 252, 82, 157, 118, 93, 22, 174]
            }
          }
        },
        {
          "name": "delegationRecordTomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [100, 101, 108, 101, 103, 97, 116, 105, 111, 110] },
              { "kind": "account", "path": "tomo" }
            ],
            "program": { "kind": "account", "path": "delegationProgram" }
          }
        },
        {
          "name": "delegationMetadataTomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [100, 101, 108, 101, 103, 97, 116, 105, 111, 110, 45, 109, 101, 116, 97, 100, 97, 116, 97] },
              { "kind": "account", "path": "tomo" }
            ],
            "program": { "kind": "account", "path": "delegationProgram" }
          }
        },
        {
          "name": "tomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 111, 109, 111] },
              { "kind": "arg", "path": "uid" }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "uid",
          "type": "string"
        }
      ]
    },
    {
      "name": "feed",
      "discriminator": [46, 213, 237, 176, 190, 113, 182, 94],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "getCoin",
      "discriminator": [199, 17, 222, 208, 64, 249, 76, 135],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "init",
      "discriminator": [220, 59, 207, 236, 108, 250, 47, 100],
      "accounts": [
        {
          "name": "tomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 111, 109, 111] },
              { "kind": "arg", "path": "uid" }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "uid",
          "type": "string"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [196, 28, 41, 206, 48, 37, 51, 167],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": { "vec": "bytes" }
        }
      ]
    },
    {
      "name": "undelegate",
      "docs": ["Undelegate the Tomo account from the ephemeral rollup"],
      "discriminator": [131, 148, 180, 198, 91, 104, 42, 238],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tomo",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delete",
      "docs": ["Delete the Tomo account, returning rent to the owner"],
      "discriminator": [165, 204, 60, 98, 134, 15, 83, 134],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "tomo",
      "discriminator": [104, 46, 161, 148, 136, 8, 66, 191]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notEnoughCoins",
      "msg": "Not enough coins to feed"
    }
  ],
  "types": [
    {
      "name": "tomo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "uid",
            "type": "string"
          },
          {
            "name": "hunger",
            "type": "u8"
          },
          {
            "name": "lastFed",
            "type": "i64"
          },
          {
            "name": "coins",
            "type": "u64"
          }
        ]
      }
    }
  ]
}

export const IDL: TomoProgram = {
  "address": "GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM",
  "metadata": {
    "name": "tomoProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "delegate",
      "docs": ["Delegate the Tomo account to the ephemeral rollup"],
      "discriminator": [90, 147, 75, 178, 85, 88, 4, 137],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferTomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [98, 117, 102, 102, 101, 114] },
              { "kind": "account", "path": "tomo" }
            ],
            "program": {
              "kind": "const",
              "value": [226, 127, 227, 97, 202, 182, 63, 229, 205, 191, 17, 155, 36, 155, 64, 81, 14, 121, 27, 23, 125, 75, 154, 185, 44, 252, 82, 157, 118, 93, 22, 174]
            }
          }
        },
        {
          "name": "delegationRecordTomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [100, 101, 108, 101, 103, 97, 116, 105, 111, 110] },
              { "kind": "account", "path": "tomo" }
            ],
            "program": { "kind": "account", "path": "delegationProgram" }
          }
        },
        {
          "name": "delegationMetadataTomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [100, 101, 108, 101, 103, 97, 116, 105, 111, 110, 45, 109, 101, 116, 97, 100, 97, 116, 97] },
              { "kind": "account", "path": "tomo" }
            ],
            "program": { "kind": "account", "path": "delegationProgram" }
          }
        },
        {
          "name": "tomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 111, 109, 111] },
              { "kind": "arg", "path": "uid" }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "GFAFC6FBpbcCVDrZfY2QyCWS3ckkgJuLMtr9KWtubhiM"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "uid",
          "type": "string"
        }
      ]
    },
    {
      "name": "feed",
      "discriminator": [46, 213, 237, 176, 190, 113, 182, 94],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "getCoin",
      "discriminator": [199, 17, 222, 208, 64, 249, 76, 135],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "init",
      "discriminator": [220, 59, 207, 236, 108, 250, 47, 100],
      "accounts": [
        {
          "name": "tomo",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [116, 111, 109, 111] },
              { "kind": "arg", "path": "uid" }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "uid",
          "type": "string"
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [196, 28, 41, 206, 48, 37, 51, 167],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": { "vec": "bytes" }
        }
      ]
    },
    {
      "name": "undelegate",
      "docs": ["Undelegate the Tomo account from the ephemeral rollup"],
      "discriminator": [131, 148, 180, 198, 91, 104, 42, 238],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tomo",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delete",
      "docs": ["Delete the Tomo account, returning rent to the owner"],
      "discriminator": [165, 204, 60, 98, 134, 15, 83, 134],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "tomo",
      "discriminator": [104, 46, 161, 148, 136, 8, 66, 191]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notEnoughCoins",
      "msg": "Not enough coins to feed"
    }
  ],
  "types": [
    {
      "name": "tomo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "uid",
            "type": "string"
          },
          {
            "name": "hunger",
            "type": "u8"
          },
          {
            "name": "lastFed",
            "type": "i64"
          },
          {
            "name": "coins",
            "type": "u64"
          }
        ]
      }
    }
  ]
}
