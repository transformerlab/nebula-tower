import subprocess
from typing import Optional, Dict, Any

class NebulaAPI:
    def __init__(self, nebula_path: str = './nebula', cert_path: str = './nebula-cert'):
        self.nebula_path = nebula_path
        self.cert_path = cert_path

    def nebula_version(self) -> str:
        return self._run([self.nebula_path, '-version'])

    def nebula_help(self) -> str:
        return self._run([self.nebula_path, '-help'])

    def nebula_test(self, config_path: str) -> str:
        return self._run([self.nebula_path, '-test', '-config', config_path])

    def nebula_run(self, config_path: str) -> str:
        return self._run([self.nebula_path, '-config', config_path])

    def cert_version(self) -> str:
        return self._run([self.cert_path, '-version'])

    def cert_help(self) -> str:
        return self._run([self.cert_path, '-help'])

    def cert_mode(self, mode: str, flags: Optional[list] = None) -> str:
        cmd = [self.cert_path, mode]
        if flags:
            cmd.extend(flags)
        return self._run(cmd)

    def sign_cert(
        self,
        name: str,
        networks: str,
        out_crt: str,
        out_key: str,
        ca_crt: str = "ca.crt",
        ca_key: str = "ca.key",
        groups: str = None,
        duration: str = None,
        in_pub: str = None,
        out_qr: str = None,
        subnets: str = None,
    ) -> str:
        """
        Sign and create a Nebula certificate for a host.

        Args:
            name: Certificate name (usually hostname)
            networks: Networks in CIDR notation (e.g., "fdc8:d0db:a315:cb00::1/64")
            groups: Comma-separated list of groups
            out_crt: Path to write the certificate
            out_key: Path to write the private key
            ca_crt: Path to CA certificate
            ca_key: Path to CA key
            duration: Optional duration (e.g., '8760h')
            in_pub: Optional path to public key
            out_qr: Optional path to output QR code
            subnets: Optional comma-separated subnets

        Returns:
            Output from nebula-cert command
        """
        cmd = [
            self.cert_path, "sign",
            "-name", name,
            "-networks", networks,
            "-out-crt", out_crt,
            "-out-key", out_key,
            "-ca-crt", ca_crt,
            "-ca-key", ca_key,
            "-version", "2",
        ]
        if groups:
            cmd += ["-groups", groups]
        if duration:
            cmd += ["-duration", duration]
        if in_pub:
            cmd += ["-in-pub", in_pub]
        if out_qr:
            cmd += ["-out-qr", out_qr]
        if subnets:
            cmd += ["-subnets", subnets]
        return self._run(cmd)

    def _run(self, cmd: list) -> str:
        try:
            print("Running command:", ' '.join(cmd))
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return result.stdout.strip() or result.stderr.strip()
        except subprocess.CalledProcessError as e:
            return e.stdout.strip() + '\n' + e.stderr.strip()
