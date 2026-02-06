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
import { STRINGS } from './strings';

export default function LoginPanel({
  lang,
  wif,
  onWifChange,
  onGenerate,
  onConnect,
  onOpenRpc,
  error
}) {
  const strings = STRINGS[lang] || STRINGS.en;

  return (
    <Box sx={{ maxWidth: 520, margin: '80px auto', px: 2 }}>
      <Card elevation={0} className="tech-panel">
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={4}>
            <Box>
              <Typography variant="h4" fontWeight={700} color="primary" sx={{ mb: 1 }}>
                {strings.login_title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Securely access the Palladium Chat network.
              </Typography>
            </Box>
            
            <TextField
              label={strings.wif_label}
              value={wif}
              onChange={(event) => onWifChange(event.target.value)}
              multiline
              minRows={3}
              placeholder="L..."
              variant="filled"
              sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}
            />
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" onClick={onOpenRpc}>
                {strings.btn_rpc_settings}
              </Button>
              <Button variant="contained" onClick={onConnect}>
                {strings.btn_start}
              </Button>
              <Button variant="text" onClick={onGenerate}>
                {strings.btn_gen_key}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
