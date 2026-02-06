import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography
} from '@mui/material';
import { STRINGS } from './strings';

export default function SettingsPanel({ lang, config, onOpenRpc }) {
  const strings = STRINGS[lang] || STRINGS.en;
  const langLabel = (config.lang || '').toUpperCase();

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 640, mx: 'auto' }}>
      <Card elevation={2} sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              {strings.tab_settings}
            </Typography>
            <Divider />
            <Stack spacing={1}>
              <Typography variant="body2">
                {strings.lbl_rpc_host}: {config.ip}
              </Typography>
              <Typography variant="body2">
                {strings.lbl_rpc_port}: {config.port}
              </Typography>
              <Typography variant="body2">
                {strings.setting_lang} {langLabel || 'EN'}
              </Typography>
              <Typography variant="body2">
                {strings.setting_rescan} {config.rescanHours}
              </Typography>
              <Typography variant="body2">
                {strings.setting_retention} {config.retentionDays}
              </Typography>
              <Typography variant="body2">
                {strings.setting_fee_rate} {config.feeRate || 1} sat/vB
              </Typography>
              <Typography variant="body2">
                {strings.setting_show_txid} {config.showTxid ? 'On' : 'Off'}
              </Typography>
              <Typography variant="body2">
                {strings.setting_allow_unconfirmed} {config.allowUnconfirmedSpend ? 'On' : 'Off'}
              </Typography>
            </Stack>
            <Button variant="contained" onClick={onOpenRpc}>
              {strings.btn_rpc_settings}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
