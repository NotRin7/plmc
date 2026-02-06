import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { STRINGS } from './strings';

export default function ChatPanel({
  lang,
  contacts,
  activeContactId,
  messages,
  onSelectContact,
  onAddContact,
  onRenameContact,
  onDeleteContact,
  onSendMessage,
  onRescan,
  showTxid,
  balanceInfo,
  defaultAmount,
  allowUnconfirmedSpend
}) {
  const strings = STRINGS[lang] || STRINGS.en;
  const defaultAmountValue = typeof defaultAmount === 'number'
    ? defaultAmount
    : Math.round(parseFloat(defaultAmount || '0') || 0);
  const defaultAmountText = defaultAmountValue ? defaultAmountValue.toString() : '0';
  const [messageText, setMessageText] = React.useState('');
  const [amountText, setAmountText] = React.useState(defaultAmountText);
  const messageListRef = React.useRef(null);

  React.useEffect(() => {
    setAmountText(defaultAmountText);
  }, [defaultAmountText]);

  React.useEffect(() => {
    if (!messageListRef.current) return;
    const node = messageListRef.current;
    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeContactId, messages.length]);

  const handleSend = () => {
    if (!activeContactId || !messageText.trim()) return;
    const amountSat = Math.max(0, Math.round(parseFloat(amountText || '0') || 0));
    const amountPlm = amountSat / 1e8;
    onSendMessage(activeContactId, messageText.trim(), amountPlm);
    setMessageText('');
    setAmountText(defaultAmountText);
  };


  const formatPubKey = (pubKey) => {
    if (!pubKey) return '';
    if (pubKey.length <= 16) return pubKey;
    return `${pubKey.slice(0, 8)}...${pubKey.slice(-8)}`;
  };


  const formatSats = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    return Math.round(value * 1e8).toLocaleString();
  };

  const selectedContact = contacts.find((c) => c.id === activeContactId);

  const formatStatus = (status) => {
    if (status === 0) return strings.status_sending;
    if (status === 1) return `${strings.status_sent} (unconfirmed)`;
    if (status === 2) return `${strings.status_sent} ✓`;
    return '';
  };

  const availableBalance = allowUnconfirmedSpend ? balanceInfo?.balance : balanceInfo?.spendableBalance;
  const hasBalance = (availableBalance || 0) > 0;

  return (
    <Box className="chat-layout" sx={{ minHeight: 0 }}>
      <Box className="tech-panel contact-list" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1 }}>
              <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'Orbitron' }}>
                {strings.contacts_title}
              </Typography>
              <Button size="small" variant="text" onClick={onAddContact} sx={{ minWidth: 0, p: 0.5 }}>
                <Typography variant="h6">+</Typography>
              </Button>
            </Stack>
            <Divider sx={{ opacity: 0.1 }} />
            <List dense sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {contacts.map((contact) => (
                <ListItemButton
                  key={contact.id}
                  className={`contact-item ${contact.id === activeContactId ? 'selected' : ''}`}
                  onClick={() => onSelectContact(contact.id)}
                  sx={{ mb: 1 }}
                >
                  <ListItemText
                    primary={contact.name || 'Anonymous'}
                    secondary={formatPubKey(contact.id)}
                    primaryTypographyProps={{ fontWeight: 600 }}
                    secondaryTypographyProps={{ sx: { fontFamily: 'Rajdhani', opacity: 0.7 } }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </Box>
      </Box>

      <Box className="tech-panel" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" fontWeight={700} sx={{ fontFamily: 'Orbitron' }}>
              {selectedContact ? selectedContact.name : strings.lbl_select_contact}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={onRescan} sx={{ borderRadius: 20 }}>
                {strings.btn_rescan}
              </Button>
              {selectedContact && (
                <Button size="small" variant="text" color="error" onClick={() => onDeleteContact(selectedContact)}>
                  Delete
                </Button>
              )}
            </Stack>
          </Stack>

          {selectedContact && (
            <Typography variant="caption" sx={{ mt: 0.5, fontFamily: 'Rajdhani', opacity: 0.5 }}>
              {selectedContact.id}
            </Typography>
          )}

          {!hasBalance && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 1, fontWeight: 600 }}>
              {balanceInfo?.balance > 0 ? strings.warn_low_balance : strings.warn_no_balance}
            </Typography>
          )}

          <Divider sx={{ my: 2, opacity: 0.1 }} />

          <Stack
            ref={messageListRef}
            className="message-list"
            spacing={1}
            sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 1 }}
          >
            {messages.map((msg) => (
              <Box
                key={msg.id}
                className={`message-bubble ${msg.sender}`}
                sx={{ alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start' }}
              >
                <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>{msg.text}</Typography>
                <Typography variant="caption" className="message-meta" component="div" sx={{ mt: 0.5 }}>
                  {new Date(msg.timestamp).toLocaleTimeString()} · {formatStatus(msg.status)}
                  {msg.sender === 'me' && typeof msg.amount === 'number' && msg.amount > 0 && ` · Amount: ${formatSats(msg.amount)} sat`}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ my: 2, opacity: 0.1 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
            <TextField
              fullWidth
              placeholder={strings.placeholder_message}
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              multiline
              maxRows={4}
              disabled={!selectedContact}
              variant="outlined"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: 'rgba(255,255,255,0.02)' } }}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                label={strings.amount_label}
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                type="number"
                size="small"
                sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
                inputProps={{ step: 1, min: 0 }}
                disabled={!selectedContact}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={!selectedContact || !messageText.trim()}
                sx={{ borderRadius: 4, height: 40, px: 4 }}
              >
                {strings.btn_send}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
