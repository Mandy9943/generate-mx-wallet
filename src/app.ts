import { Mnemonic, UserSecretKey } from "@multiversx/sdk-wallet/out";

interface IWalletInfo {
  mnemonicWords: string[];
  secretKeyHex: string;
  balance: string;
  address: string;
}

/**
 * Función de reintento genérica para operaciones asíncronas en TypeScript.
 *
 * @param asyncFunc La función asíncrona a ejecutar.
 * @param args Argumentos para la función asíncrona.
 * @param maxAttempts Número máximo de intentos antes de fallar.
 * @param delay Tiempo de espera entre intentos en milisegundos.
 * @returns Promesa con el resultado de la función asíncrona.
 * @throws Error si se alcanza el máximo número de intentos sin éxito.
 */
export async function retryAsyncFunction<T, Args extends any[]>(
  asyncFunc: (...args: Args) => Promise<T>,
  args: Args,
  maxAttempts: number = 500,
  delay: number = 500,
  skipRetryError?: {
    code?: string;
    message?: string;
  }
): Promise<T> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      // Ejecuta la función con los argumentos proporcionados y devuelve el resultado si es exitoso
      return await asyncFunc(...args);
    } catch (error: any) {
      if (skipRetryError && (skipRetryError.code || skipRetryError.message)) {
        if (
          error.code === skipRetryError.code ||
          error.message === skipRetryError.message
        ) {
          throw error;
        }
      }
      attempts++;
      console.log(`Attempt ${attempts} failed: ${(error as Error).message}`);
      if (attempts >= maxAttempts) {
        // Lanza un error después del último intento fallido
        throw new Error(
          `Max retry attempts reached. Last error: ${(error as Error).message}`
        );
      }
      // Espera por el tiempo definido antes de reintentar
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  // Este punto no debería alcanzarse, pero TypeScript necesita asegurarse de que siempre hay un retorno.
  throw new Error("Unexpected loop termination in retryAsyncFunction");
}

const fetchBalance = async (address: string): Promise<{ balance: string }> => {
  const res = await fetch(
    `https://api.multiversx.com/accounts/${address}?fields=balance`
  );
  const data = await res.json();

  return data;
};

const generateWallet = async (): Promise<IWalletInfo> => {
  const mnemonic = Mnemonic.generate();
  const words = mnemonic.getWords();

  const keyHex = mnemonic.deriveKey(0).hex();

  const secretKey = new UserSecretKey(Buffer.from(keyHex, "hex"));

  const address = secretKey.generatePublicKey().toAddress().bech32();

  const { balance } = await retryAsyncFunction(fetchBalance, [address]);

  const wallet: IWalletInfo = {
    mnemonicWords: words,
    secretKeyHex: keyHex,
    address: address,
    balance: balance,
  };

  return wallet;
};

const main = async () => {
  let loop = true;
  let finalWallet: IWalletInfo | null = null;
  let count = 0;
  while (loop) {
    const wallet = await generateWallet();

    if (Number(wallet.balance) > 0) {
      loop = false;
      finalWallet = wallet;
    }

    count++;
    console.log(
      `Wallet ${count}: ${wallet.address} | balance: ${wallet.balance}`
    );
  }

  console.log({ finalWallet });
};

main();
