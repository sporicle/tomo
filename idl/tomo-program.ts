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
      "name": "consumeRandomness",
      "docs": ["VRF callback - receives randomness and adds item to inventory"],
      "discriminator": [190, 217, 49, 162, 99, 26, 73, 234],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "docs": ["SECURITY: Validates callback is from VRF program"],
          "signer": true,
          "address": "9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw"
        },
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": { "array": ["u8", 32] }
        }
      ]
    },
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
          "signer": true,
          "relations": ["tomo"]
        }
      ],
      "args": []
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
      "name": "openItemDrop",
      "docs": [
        "Open an item drop - uses VRF to add a random item (1-5) to inventory",
        "Does nothing if inventory is full or no item drop is available"
      ],
      "discriminator": [219, 160, 62, 193, 70, 43, 189, 4],
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
          "name": "oracleQueue",
          "writable": true,
          "address": "5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc"
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              { "kind": "const", "value": [105, 100, 101, 110, 116, 105, 116, 121] }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "clientSeed",
          "type": "u8"
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
      "name": "triggerItemDrop",
      "docs": ["Trigger an item drop - sets item_drop to true if false"],
      "discriminator": [179, 100, 20, 236, 108, 141, 110, 8],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": []
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
      "name": "useItem",
      "docs": [
        "Use an item at a specific index - removes it from inventory",
        "Does nothing if the slot is empty (contains 0)"
      ],
      "discriminator": [38, 85, 191, 23, 255, 151, 204, 199],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
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
          },
          {
            "name": "itemDrop",
            "type": "bool"
          },
          {
            "name": "inventory",
            "type": { "array": ["u8", 8] }
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
      "name": "consumeRandomness",
      "docs": ["VRF callback - receives randomness and adds item to inventory"],
      "discriminator": [190, 217, 49, 162, 99, 26, 73, 234],
      "accounts": [
        {
          "name": "vrfProgramIdentity",
          "docs": ["SECURITY: Validates callback is from VRF program"],
          "signer": true,
          "address": "9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw"
        },
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "randomness",
          "type": { "array": ["u8", 32] }
        }
      ]
    },
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
          "signer": true,
          "relations": ["tomo"]
        }
      ],
      "args": []
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
      "name": "openItemDrop",
      "docs": [
        "Open an item drop - uses VRF to add a random item (1-5) to inventory",
        "Does nothing if inventory is full or no item drop is available"
      ],
      "discriminator": [219, 160, 62, 193, 70, 43, 189, 4],
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
          "name": "oracleQueue",
          "writable": true,
          "address": "5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc"
        },
        {
          "name": "programIdentity",
          "pda": {
            "seeds": [
              { "kind": "const", "value": [105, 100, 101, 110, 116, 105, 116, 121] }
            ]
          }
        },
        {
          "name": "vrfProgram",
          "address": "Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz"
        },
        {
          "name": "slotHashes",
          "address": "SysvarS1otHashes111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "clientSeed",
          "type": "u8"
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
      "name": "triggerItemDrop",
      "docs": ["Trigger an item drop - sets item_drop to true if false"],
      "discriminator": [179, 100, 20, 236, 108, 141, 110, 8],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": []
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
      "name": "useItem",
      "docs": [
        "Use an item at a specific index - removes it from inventory",
        "Does nothing if the slot is empty (contains 0)"
      ],
      "discriminator": [38, 85, 191, 23, 255, 151, 204, 199],
      "accounts": [
        {
          "name": "tomo",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
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
          },
          {
            "name": "itemDrop",
            "type": "bool"
          },
          {
            "name": "inventory",
            "type": { "array": ["u8", 8] }
          }
        ]
      }
    }
  ]
}
