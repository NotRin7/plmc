import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Stack
} from '@mui/material';
import { STRINGS } from './strings';

const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ru', label: 'Русский' },
  { value: 'it', label: 'Italiano' }
];

export default function RpcDialog({ open, onClose, config, onSave, lang }) {
  const [draft, setDraft] = React.useState(config);
  const strings = STRINGS[lang] || STRINGS.en;

  React.useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(draft);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{strings.rpc_label}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={strings.lbl_rpc_host} value={draft.ip} onChange={update('ip')} />
          <TextField label={strings.lbl_rpc_port} value={draft.port} onChange={update('port')} />
          <TextField label={strings.lbl_rpc_user} value={draft.user} onChange={update('user')} />
          <TextField
            label={strings.lbl_rpc_password}
            type="password"
            value={draft.pass}
            onChange={update('pass')}
          />
          <TextField
            select
            label={strings.setting_lang}
            value={draft.lang}
            onChange={update('lang')}
          >
            {LANG_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={strings.setting_rescan}
            type="number"
            value={draft.rescanHours}
            onChange={update('rescanHours')}
          />
          <TextField
            label={strings.setting_retention}
            type="number"
            value={draft.retentionDays}
            onChange={update('retentionDays')}
          />
          <TextField
            label={strings.setting_fee_rate}
            type="number"
            value={draft.feeRate}
            onChange={update('feeRate')}
            inputProps={{ min: 1, max: 1000, step: 1 }}
            helperText={strings.setting_fee_rate_help}
          />
          <FormControlLabel
            control={<Switch checked={!!draft.showTxid} onChange={update('showTxid')} />}
            label={strings.setting_show_txid}
          />
          <FormControlLabel
            control={<Switch checked={!!draft.allowUnconfirmedSpend} onChange={update('allowUnconfirmedSpend')} />}
            label={strings.setting_allow_unconfirmed}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{strings.btn_cancel}</Button>
        <Button variant="contained" onClick={handleSave}>
          {strings.btn_save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
