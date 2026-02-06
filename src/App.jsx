import React from 'react';
import {
  AppBar,
  Alert,
  Box,
  CssBaseline,
  Snackbar,
  Tab,
  Tabs,
  Toolbar,
  Typography
} from '@mui/material';
import { wallet } from './wallet/Wallet';
import { DEFAULT_RPC_CONFIG } from './wallet/rpc';
import LoginPanel from './ui/LoginPanel';
import ChatPanel from './ui/ChatPanel';
import ProfilePanel from './ui/ProfilePanel';
import SettingsPanel from './ui/SettingsPanel';
import RpcDialog from './ui/RpcDialog';
import ContactDialog from './ui/ContactDialog';
import { STRINGS } from './ui/strings';

export default function App() {
  const [session, setSession] = React.useState(null);
  const [wif, setWif] = React.useState('');
  const [rpcConfig, setRpcConfig] = React.useState(DEFAULT_RPC_CONFIG);
  const [contacts, setContacts] = React.useState([]);
  const [activeContactId, setActiveContactId] = React.useState(null);
  const [tab, setTab] = React.useState(0);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [rpcDialogOpen, setRpcDialogOpen] = React.useState(false);
  const [contactDialog, setContactDialog] = React.useState({ open: false, mode: 'add', contact: null });
  const [balanceInfo, setBalanceInfo] = React.useState({ balance: 0, spendableBalance: 0 });
  const [refreshTick, setRefreshTick] = React.useState(0);
  const strings = STRINGS[rpcConfig.lang] || STRINGS.en;
  const contactsRef = React.useRef(contacts);
  const autoConnectAttempted = React.useRef(false);

  React.useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  React.useEffect(() => {
    const load = async () => {
      const saved = await wallet.loadConfig();
      if (saved) {
        const merged = { ...DEFAULT_RPC_CONFIG, ...saved, mode: 'electrum' };
        if (typeof merged.defaultAmount === 'number' && merged.defaultAmount > 0 && merged.defaultAmount < 1) {
          merged.defaultAmount = Math.round(merged.defaultAmount * 1e8);
        }
        let didMigrate = false;
        if (!saved.configVersion || saved.configVersion < DEFAULT_RPC_CONFIG.configVersion) {
          if (saved.defaultAmount === 1000 || saved.defaultAmount === 800) {
            merged.defaultAmount = DEFAULT_RPC_CONFIG.defaultAmount;
            didMigrate = true;
          }
          if (saved.feeRate === 3) {
            merged.feeRate = DEFAULT_RPC_CONFIG.feeRate;
            didMigrate = true;
          }
        }
        if (merged.configVersion !== DEFAULT_RPC_CONFIG.configVersion) {
          merged.configVersion = DEFAULT_RPC_CONFIG.configVersion;
          didMigrate = true;
        }
        if (!saved.mode || saved.mode !== 'electrum') {
          merged.ip = DEFAULT_RPC_CONFIG.ip;
          merged.port = DEFAULT_RPC_CONFIG.port;
        }
        setRpcConfig(merged);
        if (didMigrate) {
          await wallet.saveConfig(merged);
        }
        if (saved.wif) setWif(saved.wif);
        if (saved.wif && !autoConnectAttempted.current) {
          autoConnectAttempted.current = true;
          connectWith(merged, saved.wif);
        }
      }
    };
    load();
  }, []);

  React.useEffect(() => {
    wallet.onIncomingMessage(async (contactId, message, isUpdate, isIncoming) => {
      if (isIncoming && contactId !== 'Anonymous') {
        const exists = contactsRef.current.find((c) => c.id === contactId);
        if (!exists) {
          await wallet.addContact(contactId, '');
          refreshContacts();
        }
      }
      setRefreshTick((tick) => tick + 1);
    });
  }, []);

  const refreshContacts = async () => {
    const list = await wallet.getContacts();
    setContacts(list);
  };

  const connectWith = async (configOverride, wifOverride) => {
    setError('');
    try {
      const info = await wallet.connectToRpc(configOverride || rpcConfig, wifOverride || wif);
      setSession(info);
      const list = await wallet.getContacts();
      setContacts(list);
      wallet.startMessagePolling();
      wallet.startBalancePolling((balances) => setBalanceInfo(balances));
      if (!activeContactId && list.length > 0) setActiveContactId(list[0].id);

      // Scansiona in background la cronologia di tutti i contatti per recuperare messaggi vecchi
      // Solo per contatti senza messaggi salvati
      if (list.length > 0) {
        (async () => {
          for (const contact of list) {
            const existingMessages = wallet.getMessages(contact.id);
            if (existingMessages.length === 0) {
              await wallet.scanContactHistory(contact.id);
              setRefreshTick((tick) => tick + 1);
            }
          }
        })();
      }
    } catch (err) {
      setError(err.message || 'Unable to connect');
    }
  };

  const handleConnect = async () => {
    return connectWith();
  };

  const handleGenerate = async () => {
    const newKey = await wallet.generateKey();
    setWif(newKey);
    setNotice(strings.msg_created);
  };

  const handleSaveRpc = async (config) => {
    const normalized = {
      ...config,
      rescanHours: Number(config.rescanHours) || 0,
      retentionDays: Number(config.retentionDays) || 0,
      feeRate: Number(config.feeRate) || 1,
      mode: 'electrum',
      configVersion: DEFAULT_RPC_CONFIG.configVersion
    };
    setRpcConfig(normalized);
    await wallet.saveConfig({ ...normalized, wif });
    setRpcDialogOpen(false);
  };

  const handleSelectContact = (contactId) => {
    setActiveContactId(contactId);
    wallet.setLastSeen(contactId, Date.now());
  };

  const handleSendMessage = async (contactId, text, amount) => {
    setError('');
    try {
      await wallet.sendMessage(contactId, text, amount);
      setRefreshTick((tick) => tick + 1);
    } catch (err) {
      setError(err.message || 'Send failed');
    }
  };

  const handleRescan = async () => {
    setError('');
    try {
      await wallet.scanChain(true); // forceRescan = true
      setRefreshTick((tick) => tick + 1);
    } catch (err) {
      setError(err.message || 'Rescan failed');
    }
  };

  const openAddContact = () => setContactDialog({ open: true, mode: 'add', contact: null });
  const openRenameContact = (contact) => setContactDialog({ open: true, mode: 'rename', contact });

  const handleSaveContact = async ({ name, pubKey }) => {
    if (contactDialog.mode === 'add') {
      if (!pubKey) {
        setError('Public key required');
        return;
      }
      await wallet.addContact(pubKey, name);
      // Dopo aver aggiunto un contatto, cerca messaggi storici con quel contatto
      await wallet.scanContactHistory(pubKey);
      // Poi fai anche un rescan normale per aggiornare i messaggi inviati
      await wallet.scanChain();
      setRefreshTick((tick) => tick + 1);
    } else if (contactDialog.contact) {
      await wallet.renameContact(contactDialog.contact.id, name);
    }
    setContactDialog({ open: false, mode: 'add', contact: null });
    refreshContacts();
  };

  const handleDeleteContact = async (contact) => {
    if (!window.confirm(strings.msg_confirm_del)) return;
    await wallet.deleteMessages(contact.id);
    if (activeContactId === contact.id) setActiveContactId(null);
    refreshContacts();
  };

  const handleLogout = async () => {
    if (!window.confirm(strings.msg_confirm_logout)) return;
    wallet.stopMessagePolling();
    wallet.stopBalancePolling();
    localStorage.removeItem('palladium_config');
    setSession(null);
    setWif('');
    setContacts([]);
    setActiveContactId(null);
    setBalanceInfo({ balance: 0, spendableBalance: 0 });
  };

  const handleReloadProfile = async () => {
    if (!rpcConfig || !wif) return;
    await handleConnect();
  };

  const messages = activeContactId ? wallet.getMessages(activeContactId) : [];

  return (
    <Box className="app-shell">
      <CssBaseline />
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img src="/logo_3.png" alt="PLMC" width={32} height={32} />
            <Typography variant="h6" fontWeight={700}>
              {strings.app_title}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {!session ? (
        <LoginPanel
          lang={rpcConfig.lang}
          wif={wif}
          onWifChange={setWif}
          onGenerate={handleGenerate}
          onConnect={handleConnect}
          onOpenRpc={() => setRpcDialogOpen(true)}
          error={error}
        />
      ) : (
        <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Tabs value={tab} onChange={(event, value) => setTab(value)}>
              <Tab label={strings.tab_chat} />
              <Tab label={strings.tab_profile} />
              <Tab label={strings.tab_settings} />
            </Tabs>
            <Box
              sx={{
                ml: 'auto',
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: 'action.hover',
                minWidth: 220
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                {strings.balance_label}
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.1 }}>
                {(rpcConfig.allowUnconfirmedSpend ? (balanceInfo.balance ?? 0) : (balanceInfo.spendableBalance ?? balanceInfo.balance ?? 0)).toFixed(8)} PLM
              </Typography>
              {balanceInfo.pendingBalance > 0 && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {strings.balance_pending_label} {balanceInfo.pendingBalance.toFixed(8)} PLM
                </Typography>
              )}
              {balanceInfo.spendableBalance !== undefined &&
               balanceInfo.balance !== undefined &&
               balanceInfo.balance !== balanceInfo.spendableBalance && (
                <Typography variant="caption" color="text.secondary">
                  {strings.balance_total_label} {balanceInfo.balance.toFixed(8)} PLM
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ mt: 3, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {tab === 0 && (
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ChatPanel
                  key={refreshTick}
                  lang={rpcConfig.lang}
                  contacts={contacts}
                  activeContactId={activeContactId}
                  messages={messages}
                  onSelectContact={handleSelectContact}
                  onAddContact={openAddContact}
                  onRenameContact={openRenameContact}
                  onDeleteContact={handleDeleteContact}
                  onSendMessage={handleSendMessage}
                  onRescan={handleRescan}
                  showTxid={rpcConfig.showTxid}
                  balanceInfo={balanceInfo}
                defaultAmount={rpcConfig.defaultAmount}
                allowUnconfirmedSpend={rpcConfig.allowUnconfirmedSpend}
                />
              </Box>
            )}
            {tab === 1 && (
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ProfilePanel
                  lang={rpcConfig.lang}
                  session={session}
                  wif={wif}
                  onReload={handleReloadProfile}
                  onLogout={handleLogout}
                />
              </Box>
            )}
            {tab === 2 && (
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <SettingsPanel
                  lang={rpcConfig.lang}
                  config={rpcConfig}
                  onOpenRpc={() => setRpcDialogOpen(true)}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}

      <RpcDialog
        open={rpcDialogOpen}
        onClose={() => setRpcDialogOpen(false)}
        config={rpcConfig}
        onSave={handleSaveRpc}
        lang={rpcConfig.lang}
      />

      <ContactDialog
        open={contactDialog.open}
        mode={contactDialog.mode}
        contact={contactDialog.contact}
        lang={rpcConfig.lang}
        initialName={contactDialog.contact?.name || ''}
        initialKey={contactDialog.contact?.id || ''}
        onClose={() => setContactDialog({ open: false, mode: 'add', contact: null })}
        onSave={handleSaveContact}
      />

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity="error" variant="filled" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar open={!!notice} autoHideDuration={4000} onClose={() => setNotice('')}>
        <Alert severity="success" variant="filled" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      </Snackbar>

    </Box>
  );
}
