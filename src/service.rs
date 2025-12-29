#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;
use self::state::{GmState, UserProfile};
use gm::{GmAbi, GmOperation, InvitationRecord, InvitationStats, MessageContent};
use async_graphql::{Object, Request, Response, Schema, SimpleObject, Subscription};
use linera_sdk::{Service, ServiceRuntime};
use linera_sdk::abi::WithServiceAbi;
use linera_sdk::linera_base_types::{AccountOwner, ChainId};


use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};

linera_sdk::service!(GmService);
impl WithServiceAbi for GmService {
    type Abi = GmAbi;
}

pub struct GmService {
    state: Arc<Mutex<GmState>>,
    runtime: Arc<ServiceRuntime<Self>>,
}

impl Service for GmService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let context = runtime.root_view_storage_context();
        let state = match GmState::load(context.clone()).await {
            Ok(state) => state,
            Err(e) => {
                log::error!("Failed to load GmState: {:?}", e);
                GmState::create_empty(context)
            }
        };
        Self {
            state: Arc::new(Mutex::new(state)),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Request) -> Response {
        let schema = Schema::build(
            QueryRoot {
                state: Arc::clone(&self.state),
                runtime: Arc::clone(&self.runtime),
            },
            MutationRoot {
                runtime: Arc::clone(&self.runtime),
                state: Arc::clone(&self.state),
            },
            SubscriptionRoot {
                runtime: Arc::clone(&self.runtime),
                state: Arc::clone(&self.state),
            },
        )
        .finish();
        schema.execute(request).await
    }
}

impl GmService {
}

#[derive(SimpleObject)]
pub struct GmRecord {
    owner: String,
    timestamp: u64,
}

#[derive(SimpleObject, Serialize, Deserialize, Debug, async_graphql::InputObject)]
pub struct SignatureData {
    pub sender: String,
    pub recipient: Option<String>,
    pub chain_id: String,
    pub timestamp: u64,
    pub nonce: u64,
    pub content: Option<String>,
}

#[derive(async_graphql::InputObject, Serialize, Deserialize, Debug)]
pub struct UserProfileInput {
    pub name: Option<String>,
    pub avatar: Option<String>,
}

#[derive(SimpleObject)]
struct SetUserProfileResult {
    success: bool,
    message: String,
}

#[derive(SimpleObject)]
pub struct SignatureVerificationResult {
    pub success: bool,
    pub message: String,
    pub verified_sender: Option<String>,
}

#[derive(SimpleObject)]
pub struct GmEvent {
    pub sender: String,
    pub sender_name: Option<String>,
    pub sender_avatar: Option<String>,
    pub recipient: Option<String>,
    pub recipient_name: Option<String>,
    pub recipient_avatar: Option<String>,
    pub timestamp: u64,
    pub nonce: u64,
    pub content: MessageContent,
}

#[derive(SimpleObject)]
struct SendGmResponse {
    success: bool,
    message: String,
    timestamp: u64,
}

#[derive(SimpleObject)]
struct CooldownStatus {
    enabled: bool,
}

#[derive(SimpleObject)]
struct CooldownCheckResult {
    in_cooldown: bool,
    remaining_time: Option<u64>,
    enabled: bool,
}

#[derive(SimpleObject)]
struct WhitelistOperationResult {
    success: bool,
    message: String,
}

#[derive(SimpleObject)]
struct TimeStat {
    time: u64,
    count: u64,
}

#[derive(SimpleObject, Serialize, Deserialize)]
struct LeaderboardUser {
    user: String,
    count: u64,
}

#[derive(SimpleObject, Serialize, Deserialize)]
struct LeaderboardChain {
    chain: String,
    count: u64,
}


#[derive(SimpleObject, Serialize, Deserialize)]
pub struct LeaderboardInvitationUser {
    pub user: String,
    pub count: u32,
}

impl GmService {
    fn simple_verify_signature(
        &self,
        signature_data: &SignatureData,
        signature: &str,
    ) -> Result<SignatureVerificationResult, async_graphql::Error> {
        if signature_data.sender.is_empty() {
            return Ok(SignatureVerificationResult {
                success: false,
                message: "Sender address cannot be empty".to_string(),
                verified_sender: None,
            });
        }
        
        if !signature_data.sender.chars().all(|c| c.is_ascii_hexdigit()) {
            return Ok(SignatureVerificationResult {
                success: false,
                message: "Invalid sender address format".to_string(),
                verified_sender: None,
            });
        }
        
        if signature_data.sender.len() < 40 {
            return Ok(SignatureVerificationResult {
                success: false,
                message: "Sender address is too short".to_string(),
                verified_sender: None,
            });
        }
        
        if signature.len() < 10 {
            return Ok(SignatureVerificationResult {
                success: false,
                message: "Invalid signature format".to_string(),
                verified_sender: None,
            });
        }
        
        if signature.chars().any(|c| !c.is_ascii_hexdigit()) {
            return Ok(SignatureVerificationResult {
                success: false,
                message: "Invalid signature format (contains non-hex characters)".to_string(),
                verified_sender: None,
            });
        }
        
        Ok(SignatureVerificationResult {
            success: true,
            message: "Signature format verification successful".to_string(),
            verified_sender: Some(signature_data.sender.clone()),
        })
    }
}

struct QueryRoot {
    state: Arc<Mutex<GmState>>,
    runtime: Arc<ServiceRuntime<GmService>>,
}

struct MutationRoot {
    runtime: Arc<ServiceRuntime<GmService>>,
    state: Arc<Mutex<GmState>>,
}

struct SubscriptionRoot {
    runtime: Arc<ServiceRuntime<GmService>>,
    state: Arc<Mutex<GmState>>,
}

#[Object]
impl QueryRoot {
    async fn get_gm_record(
        &self,
        _ctx: &async_graphql::Context<'_>,
        owner: AccountOwner,
    ) -> Result<Option<GmRecord>, async_graphql::Error> {
        let state = self.state.lock().await;
        let chain_id = self.runtime.chain_id();        
        let timestamp = state.get_last_gm(chain_id, &owner).await?;        
        let record = match timestamp {
            Some(ts) => {
                Some(GmRecord {
                    owner: owner.to_string(),
                    timestamp: ts,
                })
            },
            None => {
                None
            }
        };
        
        Ok(record)
    }

    async fn get_gm_events(
        &self,
        _ctx: &async_graphql::Context<'_>,
        sender: AccountOwner,
    ) -> Result<Vec<GmEvent>, async_graphql::Error> {
        let state = self.state.lock().await;
        let chain_id = self.runtime.chain_id();
        let events = state.get_events(chain_id, &sender).await?;
        
        let mut gm_events = Vec::new();
        for (recipient, timestamp, content) in events {
            let final_content = if content.is_text() && content.content.trim().is_empty() {
                MessageContent {
                    message_type: "text".to_string(),
                    content: "GMicrochains".to_string(),
                }
            } else {
                content
            };
            
            let sender_profile = state.get_user_profile(&sender).await.unwrap_or_default();
            let recipient_profile = match &recipient {
                Some(r) => state.get_user_profile(r).await.unwrap_or_default(),
                None => UserProfile { name: None, avatar: None },
            };
            
            gm_events.push(GmEvent {
                sender: sender.to_string(),
                sender_name: sender_profile.name,
                sender_avatar: sender_profile.avatar,
                recipient: recipient.map(|r| r.to_string()),
                recipient_name: recipient_profile.name,
                recipient_avatar: recipient_profile.avatar,
                timestamp,
                nonce: 0,
                content: final_content,
            });
        }

        gm_events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        
        Ok(gm_events)
    }

    async fn get_stream_events(
        &self,
        _ctx: &async_graphql::Context<'_>,
        _chain_id: ChainId,
    ) -> Result<Vec<GmEvent>, async_graphql::Error> {
        let state = self.state.lock().await;
        let mut all_events = Vec::new();
        
        let all_index_values = state.events.index_values().await?;
        
        for ((_event_chain_id, sender, recipient), (timestamp, content)) in all_index_values {

            let sender_profile = state.get_user_profile(&sender).await.unwrap_or_default();
            let recipient_profile = match &recipient {
                Some(r) => state.get_user_profile(r).await.unwrap_or_default(),
                None => UserProfile { name: None, avatar: None },
            };
            
            let final_content = if content.is_text() && content.content.trim().is_empty() {
                MessageContent {
                    message_type: "text".to_string(),
                    content: "GMicrochains".to_string(),
                }
            } else {
                content
            };
            
            all_events.push(GmEvent {
                sender: sender.to_string(),
                sender_name: sender_profile.name,
                sender_avatar: sender_profile.avatar,
                recipient: recipient.map(|r| r.to_string()),
                recipient_name: recipient_profile.name,
                recipient_avatar: recipient_profile.avatar,
                timestamp,
                nonce: 0,
                content: final_content,
            });
        }       
        all_events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        
        Ok(all_events)
    }

    async fn get_received_gm_events(
        &self,
        _ctx: &async_graphql::Context<'_>,
        recipient: AccountOwner,
    ) -> Result<Vec<GmEvent>, async_graphql::Error> {
        let state = self.state.lock().await;
        let chain_id = self.runtime.chain_id();
        let events = state.get_received_events(chain_id, &recipient).await?;
        let mut gm_events = Vec::new();
        
        for (sender, timestamp, content) in events {
            let final_content = if content.is_text() && content.content.trim().is_empty() {
                MessageContent {
                    message_type: "text".to_string(),
                    content: "GMicrochains".to_string(),
                }
            } else {
                content
            };
            
            let sender_profile = state.get_user_profile(&sender).await.unwrap_or_default();
            let recipient_profile = state.get_user_profile(&recipient).await.unwrap_or_default();
            
            gm_events.push(GmEvent {
                sender: sender.to_string(),
                sender_name: sender_profile.name,
                sender_avatar: sender_profile.avatar,
                recipient: Some(recipient.to_string()),
                recipient_name: recipient_profile.name,
                recipient_avatar: recipient_profile.avatar,
                timestamp,
                nonce: 0,
                content: final_content,
            });
        }
        
        gm_events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        
        Ok(gm_events)
    }

    async fn get_total_messages(&self, _ctx: &async_graphql::Context<'_>) -> Result<u64, async_graphql::Error> {
        let state = self.state.lock().await;
        let total = state.get_total_messages().await;
        Ok(total)
    }

    async fn get_chain_messages(&self, _ctx: &async_graphql::Context<'_>, chain_id: ChainId) -> Result<u64, async_graphql::Error> {
        let state = self.state.lock().await;
        let count = state.chain_messages.get(&chain_id).await?.unwrap_or(0);
        Ok(count)
    }

    async fn get_wallet_messages(&self, _ctx: &async_graphql::Context<'_>, owner: AccountOwner) -> Result<u64, async_graphql::Error> {
        let state = self.state.lock().await;      
        let has_user = state.wallet_messages.contains_key(&owner).await?;
        
        let count = state.wallet_messages.get(&owner).await?.unwrap_or(0);
        
        if !has_user {
            let mut users = Vec::new();
            state.wallet_messages.for_each_index(|user| {
                users.push(user);
                Ok(())
            }).await?;
            
            if users.is_empty() {
                log::info!("No users found in wallet messages");
            }
        }
        
        Ok(count)
    }
    
    async fn get_hourly_stats(&self, _ctx: &async_graphql::Context<'_>, chain_id: ChainId, start_hour: u64, end_hour: u64) -> Result<Vec<TimeStat>, async_graphql::Error> {
        let state = self.state.lock().await;
        let stats = state.get_hourly_stats(chain_id, start_hour, end_hour).await?;
        Ok(stats.into_iter().map(|(time, count)| TimeStat { time, count }).collect())
    }
    
    async fn get_daily_stats(&self, _ctx: &async_graphql::Context<'_>, chain_id: ChainId, start_day: u64, end_day: u64) -> Result<Vec<TimeStat>, async_graphql::Error> {
        let state = self.state.lock().await;
        let stats = state.get_daily_stats(chain_id, start_day, end_day).await?;
        Ok(stats.into_iter().map(|(time, count)| TimeStat { time, count }).collect())
    }
    
    async fn get_monthly_stats(&self, _ctx: &async_graphql::Context<'_>, chain_id: ChainId, start_month: u64, end_month: u64) -> Result<Vec<TimeStat>, async_graphql::Error> {
        let state = self.state.lock().await;
        let stats = state.get_monthly_stats(chain_id, start_month, end_month).await?;
        Ok(stats.into_iter().map(|(time, count)| TimeStat { time, count }).collect())
    }
    
    async fn get_top_users(&self, _ctx: &async_graphql::Context<'_>, limit: u32) -> Result<Vec<LeaderboardUser>, async_graphql::Error> {
        let state = self.state.lock().await;
        let current_time = self.runtime.system_time().micros();
        let top_users = state.get_top_users(limit, current_time).await?;
        Ok(top_users.into_iter().map(|(user, count)| LeaderboardUser { 
            user: user.to_string(), 
            count 
        }).collect())
    }
    
    async fn get_top_chains(&self, _ctx: &async_graphql::Context<'_>, limit: u32) -> Result<Vec<LeaderboardChain>, async_graphql::Error> {
        let state = self.state.lock().await;
        let current_time = self.runtime.system_time().micros();
        let top_chains = state.get_top_chains(limit, current_time).await?;
        Ok(top_chains.into_iter().map(|(chain, count)| LeaderboardChain { 
            chain: chain.to_string(), 
            count 
        }).collect())
    }
    
    async fn get_user_rank(&self, _ctx: &async_graphql::Context<'_>, user: AccountOwner) -> Result<u32, async_graphql::Error> {
        let state = self.state.lock().await;
        let rank = state.get_user_rank(&user).await?;
        Ok(rank)
    }
    
    async fn get_message_trend(&self, _ctx: &async_graphql::Context<'_>, chain_id: ChainId, period_days: u32) -> Result<Vec<TimeStat>, async_graphql::Error> {
        let state = self.state.lock().await;
        let current_time = self.runtime.system_time().micros();
        let trend = state.get_message_trend(chain_id, period_days, current_time).await?;
        Ok(trend.into_iter().map(|(time, count)| TimeStat { time, count }).collect())
    }
    
    async fn get_user_activity_trend(&self, _ctx: &async_graphql::Context<'_>, user: AccountOwner, period_days: u32) -> Result<Vec<TimeStat>, async_graphql::Error> {
        let state = self.state.lock().await;
        let current_time = self.runtime.system_time().micros();
        let trend = state.get_user_activity_trend(&user, period_days, current_time).await?;
        Ok(trend.into_iter().map(|(time, count)| TimeStat { time, count }).collect())
    }
    
    async fn get_next_nonce(&self, _ctx: &async_graphql::Context<'_>, owner: AccountOwner) -> Result<u64, async_graphql::Error> {
        let base_time = self.runtime.system_time().micros();
        let owner_hash = {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            
            let mut hasher = DefaultHasher::new();
            owner.to_string().hash(&mut hasher);
            hasher.finish()
        };
        
        let nonce = base_time.wrapping_add(owner_hash as u64);
        Ok(nonce)
    }
    
    async fn get_cooldown_status(&self, _ctx: &async_graphql::Context<'_>) -> Result<CooldownStatus, async_graphql::Error> {
        let state = self.state.lock().await;
        let enabled = state.is_cooldown_enabled().await;
        Ok(CooldownStatus { enabled })
    }
    
    async fn is_user_whitelisted(&self, _ctx: &async_graphql::Context<'_>, user: AccountOwner) -> Result<bool, async_graphql::Error> {
        let state = self.state.lock().await;
        let is_whitelisted = state.is_whitelisted(&user).await?;
        Ok(is_whitelisted)
    }
    
    async fn check_cooldown_status(&self, _ctx: &async_graphql::Context<'_>, user: AccountOwner) -> Result<CooldownCheckResult, async_graphql::Error> {
        let state = self.state.lock().await;
        let chain_id = self.runtime.chain_id();
        let current_time = self.runtime.system_time().micros();
        let (in_cooldown, remaining) = state.is_in_cooldown(chain_id, &user, current_time).await?;
        
        Ok(CooldownCheckResult {
            in_cooldown,
            remaining_time: remaining,
            enabled: state.is_cooldown_enabled().await,
        })
    }
    
    async fn generate_signature_message(
        &self,
        _ctx: &async_graphql::Context<'_>,
        sender: AccountOwner,
        recipient: Option<AccountOwner>,
        chain_id: ChainId,
        content: MessageContent,
    ) -> Result<String, async_graphql::Error> {
        let nonce = self.get_next_nonce(_ctx, sender).await?;
        let recipient_str = recipient.map_or("none".to_string(), |r| r.to_string());
        let content_str = if content.is_gif() {
            format!("GIF: {}", content.content)
        } else if content.is_voice() {
            format!("Voice: {}", content.content)
        } else {
            content.content.clone()
        };
        
        let message = format!(
            "GM signature verification: sender={}, receiver={}, chainID={}, nonce={}, content={}",
            sender.to_string(),
            recipient_str,
            chain_id.to_string(),
            nonce,
            content_str
        );
        Ok(message)
    }
    
    async fn verify_gm_signature(
        &self,
        _ctx: &async_graphql::Context<'_>,
        signature_data: SignatureData,
        signature: String,
    ) -> Result<SignatureVerificationResult, async_graphql::Error> {
        let service = GmService {
            state: Arc::clone(&self.state),
            runtime: Arc::clone(&self.runtime),
        };
        service.simple_verify_signature(&signature_data, &signature)
    }
    
    async fn get_invitation_stats(
        &self,
        _ctx: &async_graphql::Context<'_>,
        user: AccountOwner,
    ) -> Result<Option<InvitationStats>, async_graphql::Error> {
        let state = self.state.lock().await;
        let stats = state.get_invitation_stats(user).await?;
        Ok(stats)
    }
    
    async fn get_invitation_record(
        &self,
        _ctx: &async_graphql::Context<'_>,
        inviter: AccountOwner,
    ) -> Result<Vec<InvitationRecord>, async_graphql::Error> {
        let state = self.state.lock().await;
        let records = state.get_invitation_record(inviter).await?;
        Ok(records)
    }
    
    async fn get_user_invitation_rewards(
        &self,
        _ctx: &async_graphql::Context<'_>,
        user: AccountOwner,
    ) -> Result<u32, async_graphql::Error> {
        let state = self.state.lock().await;
        let rewards = state.get_user_invitation_rewards(user).await?;
        Ok(rewards)
    }
    
    async fn get_top_invitors(
        &self,
        _ctx: &async_graphql::Context<'_>,
        limit: u32,
    ) -> Result<Vec<LeaderboardInvitationUser>, async_graphql::Error> {
        let state = self.state.lock().await;
        let top_rewards = state.get_top_invitation_rewards(limit).await?;
        Ok(top_rewards.into_iter().map(|(user, rewards)| LeaderboardInvitationUser {
            user: user.to_string(),
            count: rewards,
        }).collect())
    }
    
    async fn get_top_invitation_rewards(
        &self,
        _ctx: &async_graphql::Context<'_>,
        limit: u32,
    ) -> Result<Vec<LeaderboardInvitationUser>, async_graphql::Error> {
        let state = self.state.lock().await;
        let top_users = state.get_top_invitation_rewards(limit).await?;
        Ok(top_users.into_iter()
            .map(|(user, rewards)| LeaderboardInvitationUser {
                user: user.to_string(),
                count: rewards,
            })
            .collect())
    }
    
    async fn get_invitation_rank(
        &self,
        _ctx: &async_graphql::Context<'_>,
        user: AccountOwner,
    ) -> Result<u32, async_graphql::Error> {
        let state = self.state.lock().await;
        let rank = state.get_invitation_rank(&user).await?;
        Ok(rank)
    }
    
    async fn get_user_profile(
        &self,
        _ctx: &async_graphql::Context<'_>,
        user: AccountOwner,
    ) -> Result<Option<UserProfile>, async_graphql::Error> {
        let state = self.state.lock().await;
        match state.get_user_profile(&user).await {
            Ok(profile) => Ok(Some(profile)),
            Err(err) => Err(async_graphql::Error::new(format!("Failed to get profile: {}", err))),
        }
    }

}

#[Subscription]
impl SubscriptionRoot {
    async fn notifications(
        &self,
        #[graphql(name = "chainId")] chain_id: ChainId,
    ) -> impl futures::Stream<Item = async_graphql::Result<String>> {
        use async_graphql::futures_util::stream;
        
        let state: Arc<Mutex<GmState>> = Arc::clone(&self.state);
        
        let (tx, rx) = tokio::sync::mpsc::channel(100);
        
        let state_clone = Arc::clone(&state);
        let chain_id_clone = chain_id;
        let runtime_clone: Arc<ServiceRuntime<GmService>> = Arc::clone(&self.runtime);
        
        tokio::spawn(async move {
            let mut last_timestamp = None;
            
            loop {
                if let Ok(events) = state_clone.lock().await.get_latest_events(chain_id_clone, last_timestamp).await {
                    let has_events = !events.is_empty();
                    
                    for event_json in events {
                        let notification = event_json;
                        
                        if tx.send(Ok(notification)).await.is_err() {
                            return;
                        }
                        
                        last_timestamp = Some(runtime_clone.system_time().micros());
                    }
                    
                    if !has_events {
                        let heartbeat_event = serde_json::json!({
                            "type": "heartbeat",
                            "timestamp": runtime_clone.system_time().micros(),
                            "message": "Subscription connection is normal, waiting for event data"
                        });
                        
                        if let Ok(heartbeat_json) = serde_json::to_string(&heartbeat_event) {
                            if tx.send(Ok(heartbeat_json)).await.is_err() {
                                return;
                            }
                        }
                    }
                }
                
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        });
        
        stream::unfold(rx, |mut rx| async move {
            match rx.recv().await {
                Some(event) => Some((event, rx)),
                None => None,
            }
        })
    }
}

#[Object]
impl MutationRoot {
    async fn send_gm(
        &self,
        _ctx: &async_graphql::Context<'_>,
        chain_id: ChainId,
        sender: AccountOwner,
        recipient: Option<AccountOwner>,
        content: MessageContent,
        inviter: Option<AccountOwner>,
    ) -> Result<SendGmResponse, async_graphql::Error> {
        self.send_gm_with_signature(_ctx, chain_id, sender, recipient, "".to_string(), 0, content, inviter).await
    }
    
    async fn send_gm_with_signature(
        &self,
        _ctx: &async_graphql::Context<'_>,
        chain_id: ChainId,
        sender: AccountOwner,
        recipient: Option<AccountOwner>,
        signature: String,
        nonce: u64,
        content: MessageContent,
        inviter: Option<AccountOwner>,
    ) -> Result<SendGmResponse, async_graphql::Error> {
        let current_chain_id = self.runtime.chain_id();
        
        if !signature.is_empty() {
            let signature_data = SignatureData {
                sender: sender.to_string(),
                recipient: recipient.as_ref().map(|r| r.to_string()),
                chain_id: chain_id.to_string(),
                timestamp: self.runtime.system_time().micros(),
                nonce,
                content: Some(serde_json::to_string(&content).unwrap_or_default()),
            };
            
            let service = GmService {
                state: Arc::clone(&self.state),
                runtime: Arc::clone(&self.runtime),
            };
            let verification_result = service.simple_verify_signature(&signature_data, &signature)?;
            
            if !verification_result.success {
                return Ok(SendGmResponse {
                    success: false,
                    message: format!("Signature verification failed: {}", verification_result.message),
                    timestamp: 0,
                });
            }
        }
        
        let state = self.state.lock().await;
            let owner = {
            match state.owner.get() {
                Some(owner) => owner.clone(),
                None => {
                    return Ok(SendGmResponse {
                        success: false,
                        message: "Contract owner not initialized".to_string(),
                        timestamp: 0,
                    });
                }
            }
        };

        let final_content = if content.is_text() && content.content.trim().is_empty() {
            MessageContent {
                message_type: "text".to_string(),
                content: "GMicrochains".to_string(),
            }
        } else {
            content
        };        
        let recipient = recipient.unwrap_or_else(|| owner.clone());
        let processed_inviter = if let Some(inviter_account) = &inviter {
            let existing_invitation = state.invitations.get(&sender).await?;
            if existing_invitation.is_none() && inviter_account == &sender {
                None
            } else {
                inviter
            }
        } else {
            inviter
        };
        
        let operation = GmOperation::Gm {
            sender,
            recipient,
            content: final_content,
            inviter: processed_inviter
        };
    
    if chain_id != current_chain_id {
        drop(state);
        self.runtime.schedule_operation(&operation);
        return Ok(SendGmResponse {
            success: true,
            message: format!("Cross-chain GM sent successfully, sender: {}, recipient: {}, chain ID: {}", 
                sender, 
                recipient,
                chain_id),
            timestamp: self.runtime.system_time().micros(),
        });
    }
    
    drop(state);
    self.runtime.schedule_operation(&operation);
    let block_height = self.runtime.next_block_height();
    Ok(SendGmResponse {
        success: true,
        message: format!("GM recorded successfully, sender: {}, recipient: {}, block height: {}", 
            sender,
            recipient.to_string(),
            block_height),
        timestamp: self.runtime.system_time().micros(),
    })
    }  
    
    async fn set_cooldown_enabled(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
        enabled: bool,
    ) -> Result<WhitelistOperationResult, async_graphql::Error> {
        let mut state = self.state.lock().await;
        let success = state.set_cooldown_enabled(&caller, enabled).await?;
        
        if success {
            let operation = GmOperation::SetCooldownEnabled { enabled };
            self.runtime.schedule_operation(&operation);
            
            Ok(WhitelistOperationResult {
                success: true,
                message: format!("24-hour limit switch has been {}, caller={}", if enabled { "enabled" } else { "disabled" }, caller),
            })
        } else {
            Ok(WhitelistOperationResult {
                success: false,
                message: format!("Insufficient permissions: only whitelist addresses can set the 24-hour limit switch, caller={}", caller),
            })
        }
    }
    
    async fn add_whitelist_address(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
        address: AccountOwner,
    ) -> Result<WhitelistOperationResult, async_graphql::Error> {
        let mut state = self.state.lock().await;
        let success = state.add_whitelist(&caller, address).await?;
        
        if success {
            Ok(WhitelistOperationResult {
                success: true,
                message: format!("Whitelist address added successfully, caller={}", caller),
            })
        } else {
            Ok(WhitelistOperationResult {
                success: false,
                message: format!("Insufficient permissions: only whitelist addresses can add to the whitelist, caller={}", caller),
            })
        }
    }
    
    async fn set_user_profile(
        &self,
        _ctx: &async_graphql::Context<'_>,
        user: AccountOwner,
        profile: UserProfileInput,
    ) -> Result<SetUserProfileResult, async_graphql::Error> {
        if let Some(name) = &profile.name {
            if name.len() > 50 {
                return Ok(SetUserProfileResult {
                    success: false,
                    message: "Name too long, maximum 50 characters".to_string(),
                });
            }
        }
        
        if let Some(avatar) = &profile.avatar {
            if !avatar.starts_with("http://") && !avatar.starts_with("https://") {
                return Ok(SetUserProfileResult {
                    success: false,
                    message: "Avatar must be a valid HTTP or HTTPS URL".to_string(),
                });
            }
        }
        
        let operation = GmOperation::SetUserProfile {
            user: user.clone(),
            name: profile.name,
            avatar: profile.avatar,
        };
        
        self.runtime.schedule_operation(&operation);
        
        Ok(SetUserProfileResult {
            success: true,
            message: "Profile update scheduled successfully".to_string(),
        })
    }
    
    async fn remove_whitelist_address(
        &self,
        _ctx: &async_graphql::Context<'_>,
        caller: AccountOwner,
        address: AccountOwner,
    ) -> Result<WhitelistOperationResult, async_graphql::Error> {
        let mut state = self.state.lock().await;
        let success = state.remove_whitelist(&caller, address).await?;
        
        if success {
            Ok(WhitelistOperationResult {
                success: true,
                message: format!("Whitelist address removed successfully, caller={}", caller),
            })
        } else {
            Ok(WhitelistOperationResult {
                success: false,
                message: format!("Insufficient permissions: only whitelist addresses can remove from the whitelist, caller={}", caller),
            })
        }
    }
    


}