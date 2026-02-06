import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  IconButton
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import DisplayIcon from '@mui/icons-material/DisplaySettings';
import ResetIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/DeleteForever';
import CacheIcon from '@mui/icons-material/Memory';
import { wallet } from '../wallet/Wallet';
import { STRINGS } from './strings';

export default function SettingsPanel({ lang, config, onOpenRpc }) {
  const strings = STRINGS[lang] || STRINGS.en;

  const handleClearCache = async () => {
    if (window.confirm(strings.msg_confirm_clear_cache)) {
      localStorage.removeItem(`palladium_processed_txids_${wallet.address}`);
      window.location.reload();
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm(strings.msg_confirm_clear_hist)) {
      localStorage.removeItem(`palladium_all_msgs_${wallet.address}`);
      localStorage.removeItem(`palladium_sent_msgs_${wallet.address}`);
      window.location.reload();
    }
  };

  const SettingRow = ({ icon: Icon, label, value, action }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5 }}>
      <Icon sx={{ mr: 2, opacity: 0.6 }} />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body1" fontWeight={500}>{label}</Typography>
        {value && <Typography variant="caption" color="text.secondary">{value}</Typography>}
      </Box>
      {action}
    </Box>
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 800, mx: 'auto', gap: 3 }}>
      
      {/* Network Settings */}
      <Card elevation={0} className="tech-panel">
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'Orbitron', mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
            <SettingsIcon sx={{ mr: 1 }} /> {strings.setting_group_network}
          </Typography>
          <Stack spacing={1}>
            <SettingRow 
              icon={SettingsIcon} 
              label={strings.rpc_label} 
              value={`${config.ip}:${config.port}`} 
              action={<Button variant="outlined" size="small" onClick={onOpenRpc}>{strings.btn_rpc_settings}</Button>}
            />
            <Divider sx={{ opacity: 0.05 }} />
            <SettingRow 
              icon={ResetIcon} 
              label={strings.btn_force_rescan} 
              action={<Button variant="text" size="small" onClick={() => window.location.reload()}>{strings.btn_rescan}</Button>}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Privacy & History */}
      <Card elevation={0} className="tech-panel">
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'Orbitron', mb: 2, color: 'secondary.main', display: 'flex', alignItems: 'center' }}>
            <SecurityIcon sx={{ mr: 1 }} /> {strings.setting_group_privacy}
          </Typography>
          <Stack spacing={1}>
            <SettingRow 
              icon={CacheIcon} 
              label={strings.btn_clear_cache} 
              value="Clears local transaction and scripthash state"
              action={<Button variant="outlined" color="warning" size="small" onClick={handleClearCache}>{strings.btn_clear_cache}</Button>}
            />
            <Divider sx={{ opacity: 0.05 }} />
            <SettingRow 
              icon={DeleteIcon} 
              label={strings.btn_clear_history} 
              value="Deletes all locally stored messages"
              action={<Button variant="contained" color="error" size="small" onClick={handleClearHistory}>{strings.btn_clear_history}</Button>}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card elevation={0} className="tech-panel">
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'Orbitron', mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
            <DisplayIcon sx={{ mr: 1 }} /> {strings.setting_group_display}
          </Typography>
          <Stack spacing={1}>
            <SettingRow 
              icon={DisplayIcon} 
              label={strings.setting_lang} 
              value={config.lang?.toUpperCase() || 'EN'} 
              action={<Button variant="text" size="small" onClick={onOpenRpc}>Change</Button>}
            />
            <Divider sx={{ opacity: 0.05 }} />
            <SettingRow 
              icon={DisplayIcon} 
              label="App Version" 
              value="v2.0.0 (Palladium Secure Chat)"
            />
          </Stack>
        </CardContent>
      </Card>

    </Box>
  );
}
