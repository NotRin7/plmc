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
      <DialogTitle sx={{ fontFamily: 'Orbitron' }}>{strings.rpc_label}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField 
            label={strings.lbl_rpc_host} 
            value={draft.ip} 
            onChange={update('ip')} 
            fullWidth 
            variant="filled"
          />
          <TextField 
            label={strings.lbl_rpc_port} 
            value={draft.port} 
            onChange={update('port')} 
            fullWidth 
            variant="filled"
          />
          
          <Divider sx={{ my: 1, opacity: 0.1 }} />
          
          <TextField
            select
            label={strings.setting_lang}
            value={draft.lang}
            onChange={update('lang')}
            variant="filled"
          >
            {LANG_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label={strings.setting_fee_rate}
            type="number"
            value={draft.feeRate}
            onChange={update('feeRate')}
            inputProps={{ min: 1, max: 1000, step: 1 }}
            helperText={strings.setting_fee_rate_help}
            variant="filled"
          />

          <Stack spacing={1}>
            <FormControlLabel
              control={<Switch checked={!!draft.showTxid} onChange={update('showTxid')} />}
              label={strings.setting_show_txid}
            />
            <FormControlLabel
              control={<Switch checked={!!draft.allowUnconfirmedSpend} onChange={update('allowUnconfirmedSpend')} />}
              label={strings.setting_allow_unconfirmed}
            />
            <FormControlLabel
              control={<Switch checked={!!draft.enableSound} onChange={update('enableSound')} />}
              label={strings.setting_sound}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} color="inherit">{strings.btn_cancel}</Button>
        <Button variant="contained" onClick={handleSave} sx={{ px: 4 }}>
          {strings.btn_save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
