// Generated from docs/openapi/content-service.json by scripts/sync-swagger.cjs
export default {
  "openapi": "3.0.3",
  "info": {
    "title": "DayFeel content-service",
    "version": "0.5.0",
    "description": "Journals, moods, companion, moderated community and S3 files. Non-health routes require bearer authentication. Socket.IO /chat contract and privacy events are documented in the content-service README."
  },
  "servers": [
    {
      "url": "/"
    }
  ],
  "security": [
    {
      "bearerAuth": []
    }
  ],
  "paths": {
    "/health": {
      "get": {
        "operationId": "health",
        "summary": "Liveness",
        "responses": {
          "200": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Health"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "security": []
      }
    },
    "/journal": {
      "post": {
        "operationId": "createJournal",
        "summary": "Screen, save, record mood and recompute streak",
        "responses": {
          "201": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/JournalWrite"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/JournalInput"
              }
            }
          }
        }
      },
      "get": {
        "operationId": "listJournal",
        "summary": "List current user journal entries",
        "responses": {
          "200": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/JournalList"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "parameters": [
          {
            "in": "query",
            "name": "limit",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            },
            "required": false
          },
          {
            "in": "query",
            "name": "before",
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "required": false
          }
        ]
      },
      "put": {
        "operationId": "replaceJournal",
        "summary": "Replace journal identified in request body",
        "responses": {
          "200": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/JournalWrite"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/JournalReplacement"
              }
            }
          }
        }
      },
      "delete": {
        "operationId": "deleteJournal",
        "summary": "Delete journal identified in request body",
        "responses": {
          "204": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/JournalId"
              }
            }
          }
        }
      }
    },
    "/journal/{id}": {
      "get": {
        "operationId": "getJournal",
        "summary": "Read owned journal entry",
        "responses": {
          "200": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/JournalEntry"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ]
      },
      "put": {
        "operationId": "replaceJournalById",
        "summary": "Screen and replace owned journal entry",
        "responses": {
          "200": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/JournalWrite"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/JournalInput"
              }
            }
          }
        },
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ]
      },
      "delete": {
        "operationId": "deleteJournalById",
        "summary": "Delete owned journal entry",
        "responses": {
          "204": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "parameters": [
          {
            "in": "path",
            "name": "id",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ]
      }
    },
    "/mood/today": {
      "put": {
        "operationId": "upsertMoodToday",
        "summary": "Upsert current local date and recompute streak",
        "responses": {
          "200": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MoodWrite"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/MoodInput"
              }
            }
          }
        }
      }
    },
    "/mood/summary": {
      "get": {
        "operationId": "moodSummary",
        "summary": "Inclusive local-date summary",
        "responses": {
          "200": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MoodSummary"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "parameters": [
          {
            "in": "query",
            "name": "range",
            "schema": {
              "type": "string",
              "enum": [
                "7d",
                "30d",
                "90d"
              ],
              "default": "7d"
            },
            "required": false
          },
          {
            "in": "query",
            "name": "timezone",
            "schema": {
              "type": "string",
              "default": "UTC",
              "description": "IANA timezone, for example Asia/Singapore. Server determines current date."
            },
            "required": false
          }
        ]
      }
    },
    "/mood/calendar": {
      "get": {
        "operationId": "moodCalendar",
        "summary": "List recorded local dates for a month",
        "responses": {
          "200": {
            "description": "Success",
            "headers": {
              "X-Trace-Id": {
                "schema": {
                  "type": "string"
                },
                "description": "Server-generated correlation ID"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/MoodCalendar"
                }
              }
            }
          },
          "400": {
            "$ref": "#/components/responses/StandardError"
          },
          "401": {
            "$ref": "#/components/responses/StandardError"
          },
          "403": {
            "$ref": "#/components/responses/StandardError"
          },
          "404": {
            "$ref": "#/components/responses/StandardError"
          },
          "409": {
            "$ref": "#/components/responses/StandardError"
          },
          "413": {
            "$ref": "#/components/responses/StandardError"
          },
          "429": {
            "$ref": "#/components/responses/StandardError"
          },
          "500": {
            "$ref": "#/components/responses/StandardError"
          },
          "503": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "parameters": [
          {
            "in": "query",
            "name": "month",
            "schema": {
              "type": "string",
              "pattern": "^\\d{4}-(0[1-9]|1[0-2])$"
            },
            "required": true
          }
        ]
      }
    },
    "/companion/conversations": {
      "post": {
        "operationId": "post_companion_conversations",
        "tags": [
          "Companion"
        ],
        "summary": "Create an owned conversation",
        "parameters": [],
        "responses": {
          "201": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ConversationCreated"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CompanionCreate"
              }
            }
          }
        }
      },
      "get": {
        "operationId": "get_companion_conversations",
        "tags": [
          "Companion"
        ],
        "summary": "List owned conversations",
        "parameters": [
          {
            "name": "cursor",
            "in": "query",
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            },
            "description": "Exclusive ObjectId cursor returned by the previous page. Newest first."
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ConversationList"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      }
    },
    "/companion/conversations/{id}/messages": {
      "get": {
        "operationId": "get_companion_conversations_id_messages",
        "tags": [
          "Companion"
        ],
        "summary": "List owned messages newest first",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          },
          {
            "name": "cursor",
            "in": "query",
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            },
            "description": "Exclusive ObjectId cursor returned by the previous page. Newest first."
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CompanionMessageList"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      },
      "post": {
        "operationId": "post_companion_conversations_id_messages",
        "tags": [
          "Companion"
        ],
        "summary": "Persist user turn, screen crisis first, then generate only when safe",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CompanionReply"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CompanionSend"
              }
            }
          }
        }
      }
    },
    "/companion/conversations/{id}": {
      "delete": {
        "operationId": "delete_companion_conversations_id_",
        "tags": [
          "Companion"
        ],
        "summary": "Delete owned conversation and all its messages",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "No content"
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      },
      "patch": {
        "operationId": "patch_companion_conversation",
        "tags": [
          "Companion"
        ],
        "summary": "Rename an owned conversation; prevents automatic title replacement",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Conversation renamed",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "id",
                    "title"
                  ],
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid title or identifier"
          },
          "401": {
            "description": "Authentication required"
          },
          "404": {
            "description": "Conversation not found"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "title"
                ],
                "properties": {
                  "title": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 120
                  }
                }
              }
            }
          }
        }
      }
    },
    "/companion/exercises": {
      "get": {
        "operationId": "get_companion_exercises",
        "tags": [
          "Companion"
        ],
        "summary": "Read fixed self-reflection exercises",
        "parameters": [],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CompanionExercises"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      }
    },
    "/circles/{id}/posts": {
      "get": {
        "operationId": "get_circles_id_posts",
        "tags": [
          "Community"
        ],
        "summary": "List visible posts for an active circle member",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "name": "cursor",
            "in": "query",
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/PostList"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      },
      "post": {
        "operationId": "post_circles_id_posts",
        "tags": [
          "Community"
        ],
        "summary": "Check restrictions and membership, moderate, save and report when needed",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CommunityCreated"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CommunityText"
              }
            }
          }
        }
      }
    },
    "/posts/{id}": {
      "get": {
        "operationId": "get_posts_id_",
        "tags": [
          "Community"
        ],
        "summary": "Read a post; held posts are author-only",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CommunityContent"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      },
      "delete": {
        "operationId": "delete_posts_id_",
        "tags": [
          "Community"
        ],
        "summary": "Remove an owned post and redact its comments",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "No content"
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      }
    },
    "/posts/{id}/comments": {
      "get": {
        "operationId": "get_posts_id_comments",
        "tags": [
          "Community"
        ],
        "summary": "List visible comments for a circle member",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          },
          {
            "name": "cursor",
            "in": "query",
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 100,
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CommentList"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      },
      "post": {
        "operationId": "post_posts_id_comments",
        "tags": [
          "Community"
        ],
        "summary": "Create a moderated comment",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/CommunityCreated"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CommunityText"
              }
            }
          }
        }
      }
    },
    "/posts/{id}/reactions": {
      "put": {
        "operationId": "put_posts_id_reactions",
        "tags": [
          "Community"
        ],
        "summary": "Replace this userâ€™s single supportive reaction",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ReactionResult"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ReactionInput"
              }
            }
          }
        }
      },
      "get": {
        "operationId": "getPostReactions",
        "tags": [
          "Community"
        ],
        "summary": "Get saved reaction and reaction counts",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ReactionState"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      }
    },
    "/comments/{id}": {
      "delete": {
        "operationId": "delete_comments_id_",
        "tags": [
          "Community"
        ],
        "summary": "Remove an owned comment",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "204": {
            "description": "No content"
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      }
    },
    "/files/download-url": {
      "get": {
        "operationId": "get_files_download_url",
        "tags": [
          "Files"
        ],
        "summary": "Authorize file access and create a fifteen-minute download URL",
        "parameters": [
          {
            "name": "objectKey",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "minLength": 1,
              "maxLength": 512
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/FileDownload"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      }
    },
    "/circles/{id}/chat/messages": {
      "get": {
        "operationId": "getCircleChatHistory",
        "tags": [
          "Community"
        ],
        "summary": "Load circle chat history, newest 50 first",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          },
          {
            "name": "cursor",
            "in": "query",
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ChatHistory"
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      }
    },
    "/posts/{id}/report": {
      "post": {
        "operationId": "reportPost",
        "tags": [
          "Community"
        ],
        "summary": "Report a post to its circle moderators",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Report recorded",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "id"
                  ],
                  "properties": {
                    "id": {
                      "type": "string",
                      "format": "uuid"
                    }
                  }
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "reason"
                ],
                "properties": {
                  "reason": {
                    "type": "string",
                    "enum": [
                      "HARASSMENT",
                      "SPAM",
                      "UNSAFE",
                      "OTHER"
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    "/comments/{id}/report": {
      "post": {
        "operationId": "reportComment",
        "tags": [
          "Community"
        ],
        "summary": "Report another member?s comment",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "pattern": "^[a-fA-F0-9]{24}$"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Report recorded",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "required": [
                    "id"
                  ],
                  "properties": {
                    "id": {
                      "type": "string",
                      "format": "uuid"
                    }
                  }
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        },
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "reason"
                ],
                "properties": {
                  "reason": {
                    "type": "string",
                    "enum": [
                      "HARASSMENT",
                      "SPAM",
                      "UNSAFE",
                      "OTHER"
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    "/moderation/reports/{id}/content": {
      "get": {
        "operationId": "getReportedContent",
        "tags": [
          "Community"
        ],
        "summary": "View reported community content after circle moderator authorization",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "nullable": true,
                  "allOf": [
                    {
                      "$ref": "#/components/schemas/CommunityContent"
                    }
                  ],
                  "properties": {
                    "kind": {
                      "type": "string",
                      "enum": [
                        "post",
                        "comment",
                        "chat"
                      ]
                    }
                  }
                }
              }
            }
          },
          "default": {
            "$ref": "#/components/responses/StandardError"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT RS256"
      },
      "internalKey": {
        "type": "apiKey",
        "in": "header",
        "name": "X-Internal-Key"
      }
    },
    "schemas": {
      "Error": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "timestamp",
          "status",
          "code",
          "message",
          "path",
          "traceId"
        ],
        "properties": {
          "timestamp": {
            "type": "string",
            "format": "date-time",
            "description": "ISO-8601 UTC"
          },
          "status": {
            "type": "integer",
            "minimum": 400,
            "maximum": 599
          },
          "code": {
            "type": "string"
          },
          "message": {
            "type": "string",
            "description": "Safe message; no submitted text"
          },
          "path": {
            "type": "string"
          },
          "traceId": {
            "type": "string"
          }
        }
      },
      "Consent": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "companionMemory"
        ],
        "properties": {
          "companionMemory": {
            "type": "boolean",
            "default": false
          }
        }
      },
      "CrisisResource": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "name",
          "url",
          "region"
        ],
        "properties": {
          "name": {
            "type": "string"
          },
          "url": {
            "type": "string",
            "format": "uri"
          },
          "region": {
            "type": "string",
            "description": "Directory region code or GLOBAL"
          },
          "phone": {
            "type": "string",
            "description": "Optional admin-managed data; never a code constant",
            "nullable": true
          }
        }
      },
      "JournalInput": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 20000
          },
          "moodScore": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "tags": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "default": []
          },
          "timezone": {
            "type": "string",
            "default": "UTC",
            "description": "IANA timezone, for example Asia/Singapore. Server determines current date."
          },
          "region": {
            "type": "string",
            "pattern": "^[A-Z]{2,10}$",
            "default": "GLOBAL"
          }
        },
        "required": [
          "text",
          "moodScore"
        ],
        "additionalProperties": false
      },
      "JournalReplacement": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 20000
          },
          "moodScore": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "tags": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "default": []
          },
          "timezone": {
            "type": "string",
            "default": "UTC",
            "description": "IANA timezone, for example Asia/Singapore. Server determines current date."
          },
          "region": {
            "type": "string",
            "pattern": "^[A-Z]{2,10}$",
            "default": "GLOBAL"
          },
          "id": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          }
        },
        "required": [
          "id",
          "text",
          "moodScore"
        ],
        "additionalProperties": false
      },
      "JournalId": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          }
        },
        "required": [
          "id"
        ],
        "additionalProperties": false
      },
      "JournalEntry": {
        "type": "object",
        "properties": {
          "_id": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          },
          "userId": {
            "type": "string"
          },
          "text": {
            "type": "string"
          },
          "moodScore": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "tags": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "default": []
          },
          "crisisFlag": {
            "type": "boolean"
          },
          "revision": {
            "type": "integer"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "_id",
          "userId",
          "text",
          "moodScore",
          "crisisFlag",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      },
      "MoodInput": {
        "type": "object",
        "properties": {
          "moodScore": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "energy": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "sleepHours": {
            "type": "number",
            "minimum": 0,
            "maximum": 24
          },
          "tags": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "default": []
          },
          "note": {
            "type": "string",
            "maxLength": 2000
          },
          "timezone": {
            "type": "string",
            "default": "UTC",
            "description": "IANA timezone, for example Asia/Singapore. Server determines current date."
          }
        },
        "required": [
          "moodScore"
        ],
        "additionalProperties": false
      },
      "MoodLog": {
        "type": "object",
        "properties": {
          "_id": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          },
          "userId": {
            "type": "string"
          },
          "date": {
            "type": "string",
            "format": "date"
          },
          "moodScore": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "energy": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          },
          "sleepHours": {
            "type": "number",
            "minimum": 0,
            "maximum": 24
          },
          "tags": {
            "type": "array",
            "maxItems": 20,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "default": []
          },
          "note": {
            "type": "string",
            "maxLength": 2000
          }
        },
        "required": [
          "_id",
          "userId",
          "date",
          "moodScore"
        ],
        "additionalProperties": false
      },
      "CrisisSupport": {
        "type": "object",
        "properties": {
          "crisisDetected": {
            "type": "boolean",
            "enum": [
              true
            ]
          },
          "message": {
            "type": "string"
          },
          "resources": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CrisisResource"
            }
          }
        },
        "required": [
          "crisisDetected",
          "message",
          "resources"
        ],
        "additionalProperties": false
      },
      "JournalWrite": {
        "type": "object",
        "properties": {
          "entry": {
            "$ref": "#/components/schemas/JournalEntry"
          },
          "support": {
            "nullable": true,
            "allOf": [
              {
                "$ref": "#/components/schemas/CrisisSupport"
              }
            ]
          },
          "streak": {
            "type": "integer",
            "minimum": 0
          }
        },
        "required": [
          "entry",
          "support",
          "streak"
        ],
        "additionalProperties": false
      },
      "JournalList": {
        "type": "object",
        "properties": {
          "entries": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/JournalEntry"
            }
          }
        },
        "required": [
          "entries"
        ],
        "additionalProperties": false
      },
      "MoodWrite": {
        "type": "object",
        "properties": {
          "mood": {
            "$ref": "#/components/schemas/MoodLog"
          },
          "streak": {
            "type": "integer",
            "minimum": 0
          }
        },
        "required": [
          "mood",
          "streak"
        ],
        "additionalProperties": false
      },
      "MoodCalendar": {
        "type": "object",
        "properties": {
          "days": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/MoodLog"
            }
          }
        },
        "required": [
          "days"
        ],
        "additionalProperties": false
      },
      "MoodSummary": {
        "type": "object",
        "properties": {
          "range": {
            "type": "string",
            "enum": [
              "7d",
              "30d",
              "90d"
            ]
          },
          "from": {
            "type": "string",
            "format": "date"
          },
          "to": {
            "type": "string",
            "format": "date"
          },
          "count": {
            "type": "integer"
          },
          "averageMood": {
            "type": "number",
            "nullable": true
          },
          "streak": {
            "type": "integer"
          },
          "days": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/MoodLog"
            }
          }
        },
        "required": [
          "range",
          "from",
          "to",
          "count",
          "averageMood",
          "streak",
          "days"
        ],
        "additionalProperties": false
      },
      "Health": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "ok"
            ]
          }
        },
        "required": [
          "status"
        ],
        "additionalProperties": false
      },
      "DomainEvent": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "type": {
            "type": "string"
          },
          "version": {
            "type": "integer",
            "enum": [
              1
            ]
          },
          "occurredAt": {
            "type": "string",
            "format": "date-time"
          },
          "payload": {
            "type": "object"
          }
        },
        "required": [
          "id",
          "type",
          "version",
          "occurredAt",
          "payload"
        ],
        "additionalProperties": false
      },
      "CompanionCreate": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120,
            "default": "New conversation"
          }
        },
        "additionalProperties": false
      },
      "CompanionSend": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 20000
          },
          "timezone": {
            "type": "string",
            "default": "UTC",
            "description": "Valid IANA timezone"
          },
          "region": {
            "type": "string",
            "minLength": 1,
            "maxLength": 16,
            "default": "GLOBAL"
          }
        },
        "required": [
          "text"
        ],
        "additionalProperties": false
      },
      "ConversationCreated": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          },
          "title": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "disclaimer": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "title",
          "createdAt",
          "disclaimer"
        ],
        "additionalProperties": false
      },
      "Conversation": {
        "type": "object",
        "properties": {
          "_id": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          },
          "title": {
            "type": "string"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "_id",
          "title",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      },
      "CompanionMessage": {
        "type": "object",
        "properties": {
          "_id": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          },
          "role": {
            "type": "string",
            "enum": [
              "USER",
              "ASSISTANT",
              "CRISIS"
            ]
          },
          "text": {
            "type": "string"
          },
          "support": {
            "$ref": "#/components/schemas/CrisisSupport"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "_id",
          "role",
          "text",
          "createdAt"
        ],
        "additionalProperties": false
      },
      "CompanionReply": {
        "type": "object",
        "properties": {
          "message": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^[a-fA-F0-9]{24}$"
              },
              "role": {
                "type": "string",
                "enum": [
                  "ASSISTANT",
                  "CRISIS"
                ]
              },
              "text": {
                "type": "string"
              },
              "createdAt": {
                "type": "string",
                "format": "date-time"
              }
            },
            "required": [
              "id",
              "role",
              "text",
              "createdAt"
            ],
            "additionalProperties": false
          },
          "support": {
            "allOf": [
              {
                "$ref": "#/components/schemas/CrisisSupport"
              }
            ],
            "nullable": true
          },
          "disclaimer": {
            "type": "string"
          }
        },
        "required": [
          "message",
          "support",
          "disclaimer"
        ],
        "additionalProperties": false
      },
      "ConversationList": {
        "type": "object",
        "properties": {
          "conversations": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Conversation"
            }
          },
          "nextCursor": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$",
            "nullable": true
          }
        },
        "required": [
          "conversations",
          "nextCursor"
        ],
        "additionalProperties": false
      },
      "CompanionMessageList": {
        "type": "object",
        "properties": {
          "messages": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CompanionMessage"
            }
          },
          "nextCursor": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$",
            "nullable": true
          }
        },
        "required": [
          "messages",
          "nextCursor"
        ],
        "additionalProperties": false
      },
      "CompanionExercises": {
        "type": "object",
        "properties": {
          "exercises": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string"
                },
                "title": {
                  "type": "string"
                },
                "steps": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": [
                "id",
                "title",
                "steps"
              ],
              "additionalProperties": false
            }
          },
          "disclaimer": {
            "type": "string"
          }
        },
        "required": [
          "exercises",
          "disclaimer"
        ],
        "additionalProperties": false
      },
      "CommunityText": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "minLength": 1,
            "maxLength": 10000
          }
        },
        "required": [
          "text"
        ],
        "additionalProperties": false
      },
      "CommunityContent": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          },
          "circleId": {
            "type": "string",
            "format": "uuid"
          },
          "authorAlias": {
            "type": "string"
          },
          "text": {
            "type": "string"
          },
          "status": {
            "type": "string",
            "enum": [
              "VISIBLE",
              "HELD",
              "REMOVED"
            ]
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "postId": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$"
          },
          "own": {
            "type": "boolean",
            "description": "Whether the authenticated viewer owns this content."
          }
        },
        "required": [
          "id",
          "circleId",
          "authorAlias",
          "text",
          "status",
          "createdAt"
        ],
        "additionalProperties": false
      },
      "CommunityCreated": {
        "type": "object",
        "properties": {
          "content": {
            "$ref": "#/components/schemas/CommunityContent"
          },
          "support": {
            "allOf": [
              {
                "$ref": "#/components/schemas/CrisisSupport"
              }
            ],
            "nullable": true
          }
        },
        "required": [
          "content",
          "support"
        ],
        "additionalProperties": false
      },
      "PostList": {
        "type": "object",
        "properties": {
          "posts": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CommunityContent"
            }
          },
          "nextCursor": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$",
            "nullable": true
          }
        },
        "required": [
          "posts",
          "nextCursor"
        ],
        "additionalProperties": false
      },
      "CommentList": {
        "type": "object",
        "properties": {
          "comments": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CommunityContent"
            }
          },
          "nextCursor": {
            "type": "string",
            "pattern": "^[a-fA-F0-9]{24}$",
            "nullable": true
          }
        },
        "required": [
          "comments",
          "nextCursor"
        ],
        "additionalProperties": false
      },
      "ReactionInput": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "support",
              "hug",
              "relate",
              "helpful",
              null
            ],
            "nullable": true,
            "description": "Reaction to save, or null to remove your reaction. Repeating a request is safe."
          }
        },
        "required": [
          "type"
        ],
        "additionalProperties": false
      },
      "ReactionResult": {
        "type": "object",
        "properties": {
          "reaction": {
            "type": "string",
            "enum": [
              "support",
              "hug",
              "relate",
              "helpful",
              null
            ],
            "nullable": true
          },
          "counts": {
            "type": "object",
            "properties": {
              "support": {
                "type": "integer",
                "minimum": 0
              },
              "hug": {
                "type": "integer",
                "minimum": 0
              },
              "relate": {
                "type": "integer",
                "minimum": 0
              },
              "helpful": {
                "type": "integer",
                "minimum": 0
              }
            },
            "additionalProperties": false
          }
        },
        "required": [
          "reaction",
          "counts"
        ],
        "additionalProperties": false
      },
      "FileDownload": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string",
            "format": "uri"
          },
          "expiresAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "url",
          "expiresAt"
        ],
        "additionalProperties": false
      },
      "WeeklyStats": {
        "type": "object",
        "properties": {
          "avgMood": {
            "type": "number",
            "nullable": true
          },
          "bestDay": {
            "type": "object",
            "properties": {
              "date": {
                "type": "string",
                "format": "date"
              },
              "mood": {
                "type": "integer",
                "minimum": 1,
                "maximum": 5
              }
            },
            "required": [
              "date",
              "mood"
            ],
            "additionalProperties": false,
            "nullable": true
          },
          "worstDay": {
            "type": "object",
            "properties": {
              "date": {
                "type": "string",
                "format": "date"
              },
              "mood": {
                "type": "integer",
                "minimum": 1,
                "maximum": 5
              }
            },
            "required": [
              "date",
              "mood"
            ],
            "additionalProperties": false,
            "nullable": true
          },
          "entryCount": {
            "type": "integer",
            "minimum": 0
          },
          "moodDays": {
            "type": "integer",
            "minimum": 0
          },
          "topTags": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "tag": {
                  "type": "string"
                },
                "count": {
                  "type": "integer",
                  "minimum": 0
                }
              },
              "required": [
                "tag",
                "count"
              ],
              "additionalProperties": false
            }
          },
          "sleepMoodCorrelation": {
            "type": "number",
            "minimum": -1,
            "maximum": 1,
            "nullable": true
          },
          "sleepMoodSamples": {
            "type": "integer",
            "minimum": 0
          }
        },
        "required": [
          "avgMood",
          "bestDay",
          "worstDay",
          "entryCount",
          "moodDays",
          "topTags",
          "sleepMoodCorrelation",
          "sleepMoodSamples"
        ],
        "additionalProperties": false
      },
      "ReactionState": {
        "type": "object",
        "properties": {
          "reaction": {
            "type": "string",
            "enum": [
              "support",
              "hug",
              "relate",
              "helpful"
            ],
            "nullable": true
          },
          "counts": {
            "type": "object",
            "properties": {
              "support": {
                "type": "integer",
                "minimum": 0
              },
              "hug": {
                "type": "integer",
                "minimum": 0
              },
              "relate": {
                "type": "integer",
                "minimum": 0
              },
              "helpful": {
                "type": "integer",
                "minimum": 0
              }
            },
            "additionalProperties": false
          }
        },
        "required": [
          "reaction",
          "counts"
        ],
        "additionalProperties": false
      },
      "ChatHistory": {
        "type": "object",
        "required": [
          "messages",
          "nextCursor"
        ],
        "properties": {
          "messages": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ChatMessage"
            }
          },
          "nextCursor": {
            "type": "string",
            "nullable": true
          }
        }
      },
      "ChatMessage": {
        "allOf": [
          {
            "$ref": "#/components/schemas/CommunityContent"
          },
          {
            "type": "object",
            "required": [
              "own"
            ],
            "properties": {
              "own": {
                "type": "boolean",
                "description": "Whether the authenticated viewer sent this message."
              }
            }
          }
        ]
      }
    },
    "responses": {
      "StandardError": {
        "description": "Sanitized error",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      }
    }
  },
  "x-kafka": {
    "consumerGroup": "content-service",
    "manualCommit": true,
    "attempts": 3,
    "processedEventTtlSeconds": 604800,
    "topics": {
      "identity-events": {
        "types": [
          "ConsentChanged",
          "ModerationActionCreated",
          "UserDeletionRequested"
        ]
      },
      "content-events": {
        "types": [
          "UserDeletionCompleted"
        ]
      },
      "<source-topic>.DLT": {
        "description": "Sanitized event ID and source topic/partition/offset only; no raw text."
      }
    }
  }
};
