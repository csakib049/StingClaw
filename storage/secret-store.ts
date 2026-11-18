import { spawnSync } from "node:child_process";

function protectWithWindowsDpapi(value: string, operation: "encrypt" | "decrypt"): string {
  if (process.platform !== "win32") {
    throw new Error("Secure API key storage currently requires Windows user-level encryption (DPAPI).");
  }

  const script = operation === "encrypt"
    ? "$ProgressPreference='SilentlyContinue'; $plain=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString -String $plain -AsPlainText -Force; ConvertFrom-SecureString -SecureString $secure"
    : "$ProgressPreference='SilentlyContinue'; $encrypted=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString -String $encrypted; $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}";
  const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    input: value,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024,
  });

  if (result.error || result.status !== 0) {
    throw new Error(`Windows could not ${operation} the API key with DPAPI.`);
  }
  const output = result.stdout.trim();
  if (!output) throw new Error(`Windows returned no API key value after ${operation}.`);
  return output;
}

export function encryptSecret(value: string): string {
  return protectWithWindowsDpapi(value, "encrypt");
}

export function decryptSecret(value: string): string {
  return protectWithWindowsDpapi(value, "decrypt");
}
