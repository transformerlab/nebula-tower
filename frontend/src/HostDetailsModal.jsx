import useSWR from 'swr';
import { Box, Button, Typography, Divider, Sheet, List, ListItem, Input, Table, Modal, ModalDialog, ModalClose, Chip } from '@mui/joy';
import { useAuthHeader } from "react-auth-kit";

import { useAuthedFetcher } from './lib/api';
import API_BASE_URL from './apiConfig';

export default function HostDetailsModal({ selectedHost, selectedOrg, onClose }) {
    const fetcher = useAuthedFetcher();
    const getAuthHeader = useAuthHeader();
    const { data: hostDetailsData, error: hostDetailsError, isLoading: hostDetailsLoading } = useSWR(
        selectedHost && selectedOrg
            ? `${API_BASE_URL}/admin/api/orgs/${encodeURIComponent(selectedOrg)}/hosts/${encodeURIComponent(selectedHost)}`
            : null,
        fetcher
    );
    const hostDetails = hostDetailsData?.host || null;

    let certs = null;
    if (hostDetails && hostDetails.cert_details) {
        certs = hostDetails.cert_details;
    }
    if (typeof certs === 'string') {
        try {
            certs = JSON.parse(certs);
        } catch {
            certs = null;
        }
    }
    let firstCert = null;
    if (Array.isArray(certs)) {
        firstCert = certs[0];
    }

    return (
        <Modal open={!!selectedHost} onClose={onClose}>
            <ModalDialog sx={{ minWidth: 400, maxWidth: 600, overflow: 'auto' }}>
                <ModalClose />
                <Typography level="h2" fontSize="1.2rem" mb={2}>
                    Host Details: <b>{selectedHost}</b>
                </Typography>
                {hostDetailsLoading && <Typography>Loading...</Typography>}
                {hostDetailsError && <Typography color="danger">{hostDetailsError.message || hostDetailsError}</Typography>}
                {hostDetails && (
                    <Box sx={{ mb: 2 }}>
                        <Typography level="body-md"><b>Name:</b> {hostDetails.name}</Typography>
                        <Typography level="body-md"><b>Org:</b> {selectedOrg}</Typography>
                        <Typography level="body-md"><b>IP Address:</b> {firstCert?.details?.networks}</Typography>
                        <Typography level="body-m"><b>Is Lighthouse:</b> {hostDetails?.config?.lighthouse?.am_lighthouse ? 'Yes' : 'No'}</Typography>
                        <Typography level="body-m"><b>Lighthouse Address:</b> {hostDetails?.config?.lighthouse?.hosts?.[0]}</Typography>
                        <Typography level="body-m"><b>Member of Groups:</b></Typography>
                        {Array.isArray(firstCert?.details?.groups) &&
                            firstCert.details.groups.map((group, idx) => (
                                <Chip
                                    key={idx}
                                >
                                    {group}
                                </Chip>
                            ))}
                        <Typography level="body-m"><b>Is Relay:</b> {hostDetails?.config?.relay?.am_relay ? 'Yes' : 'No'}</Typography>
                        {/* {JSON.stringify(hostDetails.config.lighthouse)} */}
                        {/* <pre>{JSON.stringify(firstCert, null, 2)}</pre> */}
                        <Divider sx={{ my: 2 }} />
                        <Button
                            onClick={async () => {
                                try {
                                    const downloadUrl = `${API_BASE_URL}/admin/api/orgs/${encodeURIComponent(selectedOrg)}/hosts/${encodeURIComponent(selectedHost)}/download`;

                                    const res = await fetch(downloadUrl);

                                    if (res.ok) {
                                        const blob = await res.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${selectedHost}-config.zip`;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                    }
                                } catch (error) {
                                    console.error('Download failed:', error);
                                }
                            }}
                            sx={{ mb: 4 }}
                        >
                            Download all Host Config
                        </Button>
                        {hostDetails.config && (
                            <Box sx={{ mt: 1 }}>
                                <Typography level="body2"><b>Config:</b></Typography>
                                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                                    {JSON.stringify(hostDetails.config, null, 2)}
                                </pre>
                            </Box>
                        )}

                        {hostDetails.cert_details && (
                            <Box sx={{ mt: 1 }}>
                                <Typography level="body2"><b>Certificate Details:</b></Typography>
                                {(() => {
                                    if (Array.isArray(certs)) {
                                        return certs.map((cert, idx) => (
                                            <Box key={idx} sx={{ mb: 2, p: 1, border: '1px solid #eee', borderRadius: 2, background: '#fafbfc' }}>
                                                <Typography level="body3" sx={{ mb: 1 }}><b>Certificate #{idx + 1}</b></Typography>
                                                <Table size="sm" sx={{ overflow: 'hidden' }}>
                                                    <tbody>
                                                        <tr>
                                                            <td><b>Curve</b></td>
                                                            <td>{cert.curve}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Fingerprint</b></td>
                                                            <td style={{ fontFamily: 'monospace' }}>{cert.fingerprint}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Public Key</b></td>
                                                            <td style={{ fontFamily: 'monospace' }}>{cert.publicKey}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Signature</b></td>
                                                            <td style={{ fontFamily: 'monospace' }}>{cert.signature}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Version</b></td>
                                                            <td>{cert.version}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Name</b></td>
                                                            <td>{cert.details?.name}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Issuer</b></td>
                                                            <td style={{ fontFamily: 'monospace' }}>{cert.details?.issuer}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Is CA</b></td>
                                                            <td>{cert.details?.isCa ? 'Yes' : 'No'}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Networks</b></td>
                                                            <td>
                                                                {Array.isArray(cert.details?.networks)
                                                                    ? cert.details.networks.join(', ')
                                                                    : ''}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Groups</b></td>
                                                            <td>
                                                                {Array.isArray(cert.details?.groups)
                                                                    ? cert.details.groups.join(', ')
                                                                    : (cert.details?.groups || '')}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Not Before</b></td>
                                                            <td>{cert.details?.notBefore}</td>
                                                        </tr>
                                                        <tr>
                                                            <td><b>Not After</b></td>
                                                            <td>{cert.details?.notAfter}</td>
                                                        </tr>
                                                    </tbody>
                                                </Table>
                                            </Box>
                                        ));
                                    }
                                    // fallback if not array
                                    return (
                                        <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                                            {JSON.stringify(certs, null, 2)}
                                        </pre>
                                    );
                                })()}
                            </Box>
                        )}
                        {hostDetails.cert_crt && (
                            <Box sx={{ mt: 1 }}>
                                <Typography level="body2"><b>Certificate:</b></Typography>
                                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                                    {hostDetails.cert_crt}
                                </pre>
                            </Box>
                        )}
                        {hostDetails.cert_key && (
                            <Box sx={{ mt: 1 }}>
                                <Typography level="body2"><b>Key (partial):</b></Typography>
                                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, fontSize: 13 }}>
                                    {hostDetails.cert_key.slice(0, 60)}...
                                </pre>
                            </Box>
                        )}
                    </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button onClick={onClose} variant="outlined">Close</Button>
                </Box>
            </ModalDialog>
        </Modal>)
}