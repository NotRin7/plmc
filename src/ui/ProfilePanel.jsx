import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import QRCode from 'react-qr-code';
import { STRINGS } from './strings';

export default function ProfilePanel({ lang, session, wif, onReload, onLogout }) {
  const strings = STRINGS[lang] || STRINGS.en;
  const [showWif, setShowWif] = React.useState(false);

  if (!session) {
    return (
      <Card elevation={2} sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <Typography variant="body1">Connect a wallet to view your profile.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 720, mx: 'auto' }}>
      <Card elevation={2} sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              {strings.tab_profile}
            </Typography>
            <TextField label={strings.lbl_addr} value={session.address} InputProps={{ readOnly: true }} />
            <TextField label={strings.lbl_pk} value={session.pubKey} InputProps={{ readOnly: true }} />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">{strings.lbl_wif_show}</Typography>
              <Button size="small" onClick={() => setShowWif((prev) => !prev)}>
                {showWif ? strings.btn_hide : strings.btn_show}
              </Button>
            </Stack>
            {showWif && (
              <TextField label="WIF" value={wif} InputProps={{ readOnly: true }} multiline minRows={2} />
            )}
            <Box sx={{ background: '#fff', p: 2, borderRadius: 2, width: 240 }}>
              <QRCode value={session.address} size={200} />
            </Box>
            <Button variant="outlined" onClick={onReload}>
              {strings.btn_reload_profile}
            </Button>
            <Button variant="contained" color="error" onClick={onLogout}>
              {strings.btn_logout}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
