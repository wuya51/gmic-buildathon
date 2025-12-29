#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;
use crate::state::GmState;
use linera_sdk::{Contract, ContractRuntime};
use linera_sdk::abi::WithContractAbi;
use linera_sdk::linera_base_types::{AccountOwner, StreamName, StreamUpdate};
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

    async fn instantiate(&mut self, argument: Self::InstantiationArgument) {
        log::info!("Contract instantiate called with argument: {}", argument);
        
        let mut state = self.state.lock().await;
        if state.owner.get().is_some() {
            log::info!("Contract already has an owner, skipping initialization");
            return;
        }

        let contract_address: AccountOwner = self.runtime.application_id().into();
        let _ = state.set_owner(contract_address).await;
        log::info!("Contract owner set to contract address: {}", contract_address);
        
        let chain_id = self.runtime.chain_id();
        let application_id = self.runtime.application_id().forget_abi();
        let stream_name = StreamName::from("gm_events");
        
        self.runtime.subscribe_to_events(chain_id, application_id, stream_name);
        log::info!("Contract initialization completed");
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
        };
        
        let chain_id = self.runtime.chain_id();
        let mut state = self.state.lock().await;
        let _owner = match state.owner.get() {
            Some(owner) => owner.clone(),
            None => return,
        };
        let timestamp = self.runtime.system_time();
        
        match operation {
            GmOperation::SetCooldownEnabled { enabled } => {
                let _ = state.set_cooldown_enabled(&sender, enabled).await;
                let _ = state.save().await;
            }
            GmOperation::SetUserProfile { user, name, avatar } => {
                if let Err(e) = state.set_user_profile(&user, name, avatar).await {
                    log::error!("Failed to set user profile for user {}: {:?}", user, e);
                } else {
                    log::info!("User profile set successfully for user: {}", user);
                }
            }
            GmOperation::AIChat { sender: _, recipient, prompt, max_tokens } => {
                log::info!("AI Chat triggered from {} to {} with prompt: {}", sender, recipient, prompt);
        
                let ai_response = Self::generate_ai_response(&prompt, max_tokens.unwrap_or(200)).await;
                
                let ai_content = MessageContent {
                    message_type: "text".to_string(),
                    content: ai_response,
                };
                
                if let Err(e) = state.record_gm(chain_id, sender, Some(recipient.clone()), timestamp, ai_content.clone(), None).await {
                    log::error!("Failed to record AI chat event from sender {}: {:?}", sender, e);
                    return;
                }
                
                let event_id = self.runtime.emit(
                    StreamName::from("gm_events"),
                    &GmMessage::Gm { sender, recipient: Some(recipient), timestamp, content: ai_content.clone() },
                );
                
                log::info!("AI Chat event emitted successfully for sender: {}, recipient: {}, event_id: {}", sender, recipient, event_id);
            }
            GmOperation::Gm { sender: _, recipient, content, inviter } => {
                if !Self::is_message_content_valid(&content) {
                    log::warn!("Invalid message content from sender: {}, type: {}", sender, content.message_type);
                    return;
                }
                
                let (in_cooldown, remaining_time) = match state.is_in_cooldown(chain_id, &sender, timestamp.micros()).await {
                    Ok(result) => result,
                    Err(e) => {
                        log::error!("Failed to check cooldown for sender {}: {:?}", sender, e);
                        return;
                    }
                };
                if in_cooldown {
                    log::info!("Sender {} is in cooldown, remaining time: {:?} seconds", sender, remaining_time);
                    return;
                }
                
                let contract_address = self.runtime.application_id().into();
                if recipient == contract_address {
                    log::info!("Auto-reply triggered: message sent to contract address from {}", sender);
                    
                    let ai_response = Self::generate_ai_response(&content.content, 200).await;
                    
                    let ai_content = MessageContent {
                        message_type: "text".to_string(),
                        content: ai_response,
                    };
                    
                    if let Err(e) = state.record_gm(chain_id, sender, Some(recipient.clone()), timestamp, content.clone(), inviter).await {
                        log::error!("Failed to record original GM event from sender {}: {:?}", sender, e);
                        return;
                    }
                    
                    if let Err(e) = state.record_gm(chain_id, contract_address, Some(sender.clone()), timestamp, ai_content.clone(), None).await {
                        log::error!("Failed to record AI reply event: {:?}", e);
                        return;
                    }

                    let original_event_id = self.runtime.emit(
                        StreamName::from("gm_events"),
                        &GmMessage::Gm { sender, recipient: Some(recipient.clone()), timestamp, content: content.clone() },
                    );
                    
                    let ai_event_id = self.runtime.emit(
                        StreamName::from("gm_events"),
                        &GmMessage::Gm { sender: contract_address, recipient: Some(sender), timestamp, content: ai_content.clone() },
                    );
                    
                    log::info!("Auto-reply completed: original event_id: {}, AI reply event_id: {}", original_event_id, ai_event_id);
                } else {
                    if let Err(e) = state.record_gm(chain_id, sender, Some(recipient.clone()), timestamp, content.clone(), inviter).await {
                        log::error!("Failed to record GM event from sender {}: {:?}", sender, e);
                        return;
                    }
                    
                    let event_id = self.runtime.emit(
                        StreamName::from("gm_events"),
                        &GmMessage::Gm { sender, recipient: Some(recipient), timestamp, content: content.clone() },
                    );
                    
                    log::info!("GM event emitted successfully for sender: {}, recipient: {}, event_id: {}", sender, recipient, event_id);
                }
            }
            GmOperation::ClaimInvitationRewards { sender } => {
                match state.get_user_invitation_rewards(sender.clone()).await {
                    Ok(rewards) => {
                        if rewards > 0 {
                            log::info!("User {} successfully claimed {} invitation rewards", sender, rewards);
                        } else {
                            log::info!("User {} has no invitation rewards to claim", sender);
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to claim invitation rewards for user {}: {:?}", sender, e);
                    }
                }
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
                    log::warn!("Invalid message content in execute_message from sender: {}, type: {}", sender, content.message_type);
                    return;
                }
                
                if let Err(e) = state.record_gm(self.runtime.chain_id(), sender, recipient, timestamp, content, None).await {
                    log::error!("Failed to record GM event in execute_message from sender {}: {:?}", sender, e);
                } else {
                    log::info!("GM message executed successfully for sender: {}", sender);
                }
            }
        }
    }

    async fn process_streams(&mut self, updates: Vec<StreamUpdate>) {
        let mut processed_count = 0;
        let error_count = 0;
        
        for update in updates {
            let stream_name_str = update.stream_id.stream_name.to_string();
            
            if stream_name_str == "gm_events" || String::from_utf8_lossy(&update.stream_id.stream_name.0) == "gm_events" {
                for index in update.previous_index..update.next_index {
                    let event_data = self.runtime.read_event(
                        update.chain_id,
                        update.stream_id.stream_name.clone(),
                        index
                    );
                    
                    log::debug!("Read event from stream {} at index {}", stream_name_str, index);
                    
                    self.store_gm_event_for_service(event_data).await;
                    processed_count += 1;
                }
            }
        }
        
        if processed_count > 0 || error_count > 0 {
            log::info!("Processed {} stream events with {} errors", processed_count, error_count);
        }
    }

    async fn store(self) {
        let mut state = self.state.lock().await;
        match state.save().await {
            Ok(_) => {
                log::debug!("State saved successfully");
            }
            Err(e) => {
                log::error!("Failed to save state: {:?}", e);
            }
        }
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

    async fn store_gm_event_for_service(&mut self, gm_message: GmMessage) {
        let mut state = self.state.lock().await;
        
        let chain_id = self.runtime.chain_id();
        
        match gm_message {
            GmMessage::Gm { sender, recipient, timestamp: event_timestamp, content: _ } => {
                let key = (chain_id, event_timestamp.micros());

                let message_json = match serde_json::to_string(&gm_message) {
                    Ok(json) => json,
                    Err(e) => {
                        log::error!("Failed to serialize GM message for sender {}: {:?}", sender, e);
                        return;
                    }
                };
                
                match state.stream_events.insert(&key, message_json) {
                    Ok(_) => {
                        log::debug!("Stored GM event for service: sender {}, recipient {:?}, timestamp {}", sender, recipient, event_timestamp.micros());
                    }
                    Err(e) => {
                        log::error!("Failed to store GM event for service: sender {}, error: {:?}", sender, e);
                    }
                }
            }
        }
    }
}

impl GmContract {

    async fn generate_ai_response(prompt: &str, max_tokens: u32) -> String {
        log::info!("Generating AI response for prompt: {}, max_tokens: {}", prompt, max_tokens);
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