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
      <Card elevation={2} className="contact-list" sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={700}>
                {strings.contacts_title}
              </Typography>
              <Button size="small" onClick={onAddContact}>
                {strings.btn_new_contact}
              </Button>
            </Stack>
            <Divider />
            <List dense sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {contacts.map((contact) => (
                <ListItemButton
                  key={contact.id}
                  selected={contact.id === activeContactId}
                  onClick={() => onSelectContact(contact.id)}
                >
                  <ListItemText
                    primary={contact.name}
                    secondary={formatPubKey(contact.id)}
                  />
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </CardContent>
      </Card>

      <Card elevation={2} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              {selectedContact ? selectedContact.name : strings.lbl_select_contact}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={onRescan}>
                {strings.btn_rescan}
              </Button>
              {selectedContact && (
                <Button size="small" onClick={() => onRenameContact(selectedContact)}>
                  Rename
                </Button>
              )}
              {selectedContact && (
                <Button size="small" color="error" onClick={() => onDeleteContact(selectedContact)}>
                  Delete
                </Button>
              )}
            </Stack>
          </Stack>

          {selectedContact && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {selectedContact.id}
            </Typography>
          )}

          {!hasBalance && (
            <Typography color="warning.main" sx={{ mt: 1 }}>
              {balanceInfo?.balance > 0 ? strings.warn_low_balance : strings.warn_no_balance}
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

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
                <Typography variant="body1">{msg.text}</Typography>
                <Typography variant="caption" className="message-meta" component="div">
                  {new Date(msg.timestamp).toLocaleString()} · {formatStatus(msg.status)}
                  {msg.sender === 'me' && typeof msg.amount === 'number' && msg.amount > 0 && ` · Amount: ${formatSats(msg.amount)} sat`}
                  {msg.sender === 'me' && typeof msg.fee === 'number' && ` · Fee: ${formatSats(msg.fee)} sat`}
                  {msg.sender === 'me' && typeof msg.totalSpent === 'number' && ` · Total: ${formatSats(msg.totalSpent)} sat`}
                  {msg.sender !== 'me' && typeof msg.amount === 'number' && ` · ${formatSats(msg.amount)} sat`}
                </Typography>
                {showTxid && msg.txid && (
                  <Typography variant="caption" className="message-meta" component="div">
                    TXID: {msg.txid}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              fullWidth
              placeholder={strings.placeholder_message}
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              multiline
              minRows={2}
              disabled={!selectedContact}
            />
            <TextField
              label={strings.amount_label}
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              type="number"
              sx={{ width: 160 }}
              inputProps={{ step: 1, min: 0 }}
              disabled={!selectedContact}
            />
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={!selectedContact || !messageText.trim()}
            >
              {strings.btn_send}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
