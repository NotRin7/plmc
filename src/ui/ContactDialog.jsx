import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack
} from '@mui/material';
import { STRINGS } from './strings';

export default function ContactDialog({
  open,
  onClose,
  onSave,
  lang,
  mode = 'add',
  initialName = '',
  initialKey = ''
}) {
  const strings = STRINGS[lang] || STRINGS.en;
  const [name, setName] = React.useState(initialName);
  const [pubKey, setPubKey] = React.useState(initialKey);

  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setPubKey(initialKey);
    }
  }, [open, initialName, initialKey]);

  const handleSave = () => {
    onSave({ name, pubKey });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {mode === 'add' ? strings.btn_new_contact : strings.dlg_rename}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mode === 'add' && (
            <TextField
              label={strings.dlg_new_key}
              value={pubKey}
              onChange={(event) => setPubKey(event.target.value.trim())}
              placeholder={strings.dlg_new_key}
            />
          )}
          <TextField
            label={strings.dlg_new_name}
            value={name}
            onChange={(event) => setName(event.target.value)}
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
