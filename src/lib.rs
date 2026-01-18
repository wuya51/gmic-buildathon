#![cfg_attr(target_arch = "wasm32", no_main)]

use serde::{Deserialize, Serialize};
use linera_sdk::linera_base_types::{AccountOwner, Timestamp};
use linera_sdk::abi::{ContractAbi, ServiceAbi};
use async_graphql::{InputObject, SimpleObject};
pub type MessageType = String;

#[derive(Clone, Serialize, Deserialize, Debug, SimpleObject, InputObject)]
#[graphql(input_name = "MessageContentInput")]
pub struct MessageContent {
    pub message_type: MessageType,
    pub content: String,
}

impl MessageContent {
    pub fn is_text(&self) -> bool {
        self.message_type == "text"
    }
    
    pub fn is_gif(&self) -> bool {
        self.message_type == "gif"
    }
    
    pub fn is_voice(&self) -> bool {
        self.message_type == "voice"
    }
    
    pub fn is_valid_message_type(&self) -> bool {
        matches!(&self.message_type as &str, "text" | "gif" | "voice")
    }
}

pub fn is_valid_message_type(message_type: &str) -> bool {
    matches!(message_type, "text" | "gif" | "voice")
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum GmMessage {
    Gm {
        sender: AccountOwner,
        recipient: Option<AccountOwner>,
        timestamp: Timestamp,
        content: MessageContent,
    },
}

pub struct GmAbi;

impl ContractAbi for GmAbi {
    type Operation = GmOperation;
    type Response = ();
}

impl ServiceAbi for GmAbi {
    type Query = async_graphql::Request;
    type QueryResponse = async_graphql::Response;
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum GmOperation {
    Gm { sender: AccountOwner, recipient: AccountOwner, content: MessageContent, inviter: Option<AccountOwner> },
    ClaimInvitationRewards { sender: AccountOwner },
    SetCooldownEnabled { caller: AccountOwner, enabled: bool },
    AddWhitelistAddress { caller: AccountOwner, address: AccountOwner },
    RemoveWhitelistAddress { caller: AccountOwner, address: AccountOwner },
    SetUserProfile { user: AccountOwner, name: Option<String>, avatar: Option<String> },
    AIChat { sender: AccountOwner, recipient: AccountOwner, prompt: String, max_tokens: Option<u32> },
}

#[derive(Clone, Serialize, Deserialize, Debug, async_graphql::SimpleObject)]
pub struct InvitationRecord {
    pub inviter: AccountOwner,
    pub invitee: AccountOwner,
    pub invited_at: Timestamp,
    pub rewarded: bool,
    pub rewarded_at: Option<Timestamp>,
}

#[derive(Clone, Serialize, Deserialize, Debug, async_graphql::SimpleObject)]
pub struct InvitationStats {
    pub total_invited: u32,
    pub total_rewards: u32,
    pub last_reward_time: Option<Timestamp>,
}
