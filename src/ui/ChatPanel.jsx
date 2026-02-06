import React from 'react';
import {
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentCopy';
import SentIcon from '@mui/icons-material/Done';
import ConfirmedIcon from '@mui/icons-material/DoneAll';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
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

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
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

  const StatusIndicator = ({ status }) => {
    if (status === 0) return <SentIcon sx={{ fontSize: 14, opacity: 0.5 }} />;
    if (status === 1) return <SentIcon sx={{ fontSize: 14, color: 'primary.main' }} />;
    if (status === 2) return <ConfirmedIcon sx={{ fontSize: 14, color: 'primary.main' }} />;
    return null;
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
              <IconButton size="small" onClick={onAddContact} color="primary">
                <AddIcon />
              </IconButton>
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
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, mb: 1 }}>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ fontFamily: 'Orbitron' }}>
                {selectedContact ? selectedContact.name : strings.lbl_select_contact}
              </Typography>
              {selectedContact && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="caption" sx={{ fontFamily: 'Rajdhani', opacity: 0.5 }}>
                    {formatPubKey(selectedContact.id)}
                  </Typography>
                  <Tooltip title="Copy Public Key">
                    <IconButton size="small" onClick={() => handleCopy(selectedContact.id)} sx={{ p: 0.2 }}>
                      <CopyIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" onClick={onRescan} title={strings.btn_rescan}>
                <RefreshIcon />
              </IconButton>
              {selectedContact && (
                <IconButton size="small" color="error" onClick={() => onDeleteContact(selectedContact)}>
                  <DeleteIcon />
                </IconButton>
              )}
            </Stack>
          </Stack>

          {!hasBalance && (
            <Typography variant="caption" color="warning.main" sx={{ px: 1, fontWeight: 600 }}>
              {balanceInfo?.balance > 0 ? strings.warn_low_balance : strings.warn_no_balance}
            </Typography>
          )}

          <Divider sx={{ my: 1, opacity: 0.1 }} />

          {/* Chat Messages */}
          <Stack
            ref={messageListRef}
            className="message-list"
            spacing={1}
            sx={{ 
              flex: 1, 
              minHeight: 0, 
              overflowY: 'auto', 
              pr: 1, 
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0, 242, 255, 0.02) 0%, transparent 100%)',
              p: 2
            }}
          >
            {messages.map((msg) => (
              <Box
                key={msg.id}
                className={`message-bubble ${msg.sender}`}
                sx={{ 
                  alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
                  minWidth: 120,
                  boxShadow: msg.sender === 'me' ? '0 2px 8px rgba(0, 242, 255, 0.1)' : '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                <Typography variant="body1" sx={{ wordBreak: 'break-word', pr: 2 }}>{msg.text}</Typography>
                
                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                  {typeof msg.amount === 'number' && msg.amount > 0 && (
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, mr: 'auto', fontSize: 10 }}>
                      +{formatSats(msg.amount)} sat
                    </Typography>
                  )}
                  <Typography variant="caption" className="message-meta" sx={{ opacity: 0.6, fontSize: 10 }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  {msg.sender === 'me' && <StatusIndicator status={msg.status} />}
                </Stack>

                {showTxid && msg.txid && (
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5, borderTop: '1px solid rgba(255,255,255,0.05)', pt: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: 9, opacity: 0.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      TX: {msg.txid}
                    </Typography>
                    <IconButton size="small" onClick={() => handleCopy(msg.txid)} sx={{ p: 0.2 }}>
                      <CopyIcon sx={{ fontSize: 10 }} />
                    </IconButton>
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>

          <Divider sx={{ my: 1, opacity: 0.1 }} />

          {/* Input Area */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-end" sx={{ p: 1 }}>
            <TextField
              fullWidth
              placeholder={strings.placeholder_message}
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              multiline
              maxRows={4}
              disabled={!selectedContact}
              variant="outlined"
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 6, bgcolor: 'rgba(255,255,255,0.02)' } }}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="sat"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                type="number"
                size="small"
                variant="standard"
                sx={{ width: 60 }}
                inputProps={{ step: 1, min: 0 }}
                disabled={!selectedContact}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={!selectedContact || !messageText.trim()}
                sx={{ borderRadius: 6, height: 40, px: 3, fontWeight: 700 }}
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
