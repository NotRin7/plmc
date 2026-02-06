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
    <Box sx={{ maxWidth: 520, margin: '40px auto' }}>
      <Card elevation={3}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={700}>
              {strings.login_title}
            </Typography>
            <TextField
              label={strings.wif_label}
              value={wif}
              onChange={(event) => onWifChange(event.target.value)}
              multiline
              minRows={3}
              placeholder="L..."
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
