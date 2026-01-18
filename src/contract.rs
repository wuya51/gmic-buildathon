#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;
use crate::state::GmState;
use linera_sdk::{Contract, ContractRuntime};
use linera_sdk::abi::WithContractAbi;
use linera_sdk::linera_base_types::{AccountOwner, StreamName};
use linera_sdk::views::RootView;
use std::sync::Arc;
use tokio::sync::Mutex;
use gm::{GmAbi, GmMessage, GmOperation, MessageContent};

linera_sdk::contract!(GmContract);

pub struct GmContract {
    state: Arc<Mutex<GmState>>,
    runtime: ContractRuntime<Self>,
}

impl Contract for GmContract {
    type Message = GmMessage;
    type Parameters = ();
    type InstantiationArgument = serde_json::Value;
    type EventValue = GmMessage;

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let context = runtime.root_view_storage_context();
        let state = match GmState::load(context.clone()).await {
            Ok(state) => state,
            Err(_) => {
                GmState::create_empty(context)
            }
        };
        Self {
            state: Arc::new(Mutex::new(state)),
            runtime,
        }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        let mut state = self.state.lock().await;
        if state.owner.get().is_some() {
            return;
        }

        let contract_address: AccountOwner = self.runtime.application_id().into();
        let _ = state.set_owner(contract_address).await;
        
        let chain_id = self.runtime.chain_id();
        let application_id = self.runtime.application_id().forget_abi();
        let stream_name = StreamName::from("gm_events");
        
        self.runtime.subscribe_to_events(chain_id, application_id, stream_name);
    }

    async fn execute_operation(&mut self, operation: GmOperation) {
        let sender = match &operation {
            GmOperation::SetCooldownEnabled { .. } => {
                match self.runtime.authenticated_signer() {
                    Some(sender) => sender,
                    None => return,
                }
            }
            GmOperation::Gm { sender, recipient: _, content: _, inviter: _ } => sender.clone(),
            GmOperation::ClaimInvitationRewards { sender } => sender.clone(),
            GmOperation::SetUserProfile { user, .. } => user.clone(),
            GmOperation::AIChat { sender, .. } => sender.clone(),
            GmOperation::AddWhitelistAddress { caller, .. } => caller.clone(),
            GmOperation::RemoveWhitelistAddress { caller, .. } => caller.clone(),
        };
        
        let chain_id = self.runtime.chain_id();
        let mut state = self.state.lock().await;
        let _owner = match state.owner.get() {
            Some(owner) => owner.clone(),
            None => return,
        };
        let timestamp = self.runtime.system_time();
        
        match operation {
            GmOperation::SetCooldownEnabled { caller, enabled } => {
                let result = state.set_cooldown_enabled(&caller, enabled).await;
                match result {
                    Ok(true) => {
                        let _ = state.save().await;
                    }
                    Ok(false) => {
                    }
                    Err(_) => {
                    }
                }
            }
            GmOperation::AddWhitelistAddress { caller, address } => {
                let result = state.add_whitelist(&caller, address).await;
                match result {
                    Ok(true) => {
                        let _ = state.save().await;
                    }
                    Ok(false) => {
                    }
                    Err(_) => {
                    }
                }
            }
            GmOperation::RemoveWhitelistAddress { caller, address } => {
                let result = state.remove_whitelist(&caller, address).await;
                match result {
                    Ok(true) => {
                        let _ = state.save().await;
                    }
                    Ok(false) => {
                    }
                    Err(_) => {
                    }
                }
            }
            GmOperation::SetUserProfile { user, name, avatar } => {
                if let Err(_) = state.set_user_profile(&user, name, avatar).await {
                } else {
                    let _ = state.save().await;
                }
            }
            GmOperation::AIChat { sender: _, recipient, prompt, max_tokens } => {
                let ai_response = Self::generate_ai_response(&prompt, max_tokens.unwrap_or(200)).await;
                
                let ai_content = MessageContent {
                    message_type: "text".to_string(),
                    content: ai_response,
                };
                
                if let Err(_) = state.record_gm(chain_id, sender, Some(recipient.clone()), timestamp, ai_content.clone(), None).await {
                    return;
                }
                
                let _ = self.runtime.emit(
                    StreamName::from("gm_events"),
                    &GmMessage::Gm { sender, recipient: Some(recipient), timestamp, content: ai_content.clone() },
                );
            }
            GmOperation::Gm { sender: _, recipient, content, inviter } => {
                if !Self::is_message_content_valid(&content) {
                    return;
                }
                
                let (in_cooldown, _remaining_time) = match state.is_in_cooldown(chain_id, &sender, timestamp.micros()).await {
                    Ok(result) => result,
                    Err(_) => {
                        return;
                    }
                };
                if in_cooldown {
                    return;
                }
                
                let contract_address = self.runtime.application_id().into();
                if recipient == contract_address {
                    let ai_response = Self::generate_ai_response(&content.content, 200).await;
                    
                    let ai_content = MessageContent {
                        message_type: "text".to_string(),
                        content: ai_response,
                    };
                    
                    if let Err(_) = state.record_gm(chain_id, sender, Some(recipient.clone()), timestamp, content.clone(), inviter).await {
                        return;
                    }
                    
                    if let Err(_) = state.record_gm(chain_id, contract_address, Some(sender.clone()), timestamp, ai_content.clone(), None).await {
                        return;
                    }

                    let _ = self.runtime.emit(
                        StreamName::from("gm_events"),
                        &GmMessage::Gm { sender, recipient: Some(recipient.clone()), timestamp, content: content.clone() },
                    );
                    
                    let _ = self.runtime.emit(
                        StreamName::from("gm_events"),
                        &GmMessage::Gm { sender: contract_address, recipient: Some(sender), timestamp, content: ai_content.clone() },
                    );
                } else {
                    if let Err(_) = state.record_gm(chain_id, sender, Some(recipient.clone()), timestamp, content.clone(), inviter).await {
                        return;
                    }
                    
                    let _ = self.runtime.emit(
                        StreamName::from("gm_events"),
                        &GmMessage::Gm { sender, recipient: Some(recipient), timestamp, content: content.clone() },
                    );
                }
            }
            GmOperation::ClaimInvitationRewards { sender } => {
                let _ = state.get_user_invitation_rewards(sender.clone()).await;
            }
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        let mut state = self.state.lock().await;
        match message {
            GmMessage::Gm {
                sender,
                recipient,
                timestamp,
                content,
            } => {
                if !Self::is_message_content_valid(&content) {
                    return;
                }
                
                let _ = state.record_gm(self.runtime.chain_id(), sender, recipient, timestamp, content, None).await;
            }
        }
    }



    async fn store(self) {
        let mut state = self.state.lock().await;
        let _ = state.save().await;
    }
}

impl GmContract {
    pub fn is_message_content_valid(content: &MessageContent) -> bool {
        if !content.is_valid_message_type() {
            return false;
        }
        
        if content.is_text() {
            if content.content.is_empty() {
                return true;
            }
            
            if content.content.len() > 280 {
                return false;
            }
            
            if content.content.contains("<script") || content.content.contains("</script>") || 
               content.content.contains("<iframe") || content.content.contains("javascript:") {
                return false;
            }
            
            let sensitive_words = vec![
                "spam", "abuse", "hate", "violence", "illegal", "scam", "fraud"
            ];
            
            let content_lower = content.content.to_lowercase();
            for word in sensitive_words {
                if content_lower.contains(word) {
                    return false;
                }
            }
            
            true
        } else if content.is_gif() || content.is_voice() {
            if content.content.len() > 500 {
                return false;
            }
            
            if !content.content.starts_with("http://") && !content.content.starts_with("https://") {
                return false;
            }

            if content.content.contains("<script") || content.content.contains("javascript:") {
                return false;
            }
            
            true
        } else {
            false
        }
    }


    async fn generate_ai_response(_prompt: &str, max_tokens: u32) -> String {
        let response = "🤖 GMIC Guide:\n📝 Send: Text/GIF/Voice messages\n💬 Chats: View conversation history\n👤 Profile: Set personal info & avatar\n🏆 Leaderboard: Active user rankings\n👥 Invite: Friends earn rewards💰".to_string();

        if response.len() > max_tokens as usize {
            response.chars().take(max_tokens as usize).collect()
        } else {
            response
        }
    }
}

impl WithContractAbi for GmContract {
    type Abi = GmAbi;
}