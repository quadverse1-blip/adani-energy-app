import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User as UserIcon,
  Lock,
  Settings2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { CONFIG } from '../../config';
import { apiClient, setApiBaseUrl } from '../../services/api';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { AppButton } from '../../components/common/AppButton';
import { AppInput } from '../../components/common/AppInput';
import { requestRequiredAppPermissions } from '../../utils/permissionUtils';

interface LoginScreenProps {
  navigation: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('b4S/Adani/Admin');
  const [password, setPassword] = useState('password');
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Server Endpoint Config Modal (available on network error)
  const [serverUrl, setServerUrl] = useState(CONFIG.API_BASE_URL);
  const [showServerModal, setShowServerModal] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    setFormError(null);
    if (!username.trim()) {
      setFormError('Please enter your Employee ID or Mobile Number');
      return;
    }
    if (!password) {
      setFormError('Please enter your password');
      return;
    }

    try {
      await login(username.trim(), password);
      // Immediately take required permissions (Location & Camera) right after login
      try {
        await requestRequiredAppPermissions(true);
      } catch (permErr) {
        console.warn('Post-login permissions notice:', permErr);
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication failed.';
      if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('connection') ||
        msg.toLowerCase().includes('timeout')
      ) {
        setFormError(
          `Network Error: Cannot connect to backend at ${apiClient.defaults.baseURL}. If using a physical phone, ensure the server is running on your Wi-Fi LAN IP.`
        );
      } else {
        setFormError(msg);
      }
    }
  };

  const handleTestConnection = async (urlToTest?: string) => {
    const target = (urlToTest || serverUrl).trim().replace(/\/+$/, '');
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${target}/`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        setConnectionStatus(`Connected successfully! Server is online.`);
        setApiBaseUrl(target);
        setServerUrl(target);
      } else {
        setConnectionStatus(`Server responded with HTTP ${res.status}`);
      }
    } catch (e: any) {
      setConnectionStatus(
        `Failed to reach ${target}. Ensure server is started with --host 0.0.0.0 and phone is on same Wi-Fi.`
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const fillDemo = (demoUser: string) => {
    setUsername(demoUser);
    setPassword('password');
    setFormError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 20) + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Branded Logo Header */}
        <View style={styles.topLogoHeader}>
          <View style={styles.logoCardWrapper}>
            <Image
              source={require('../../../assets/adani_logo.png')}
              style={styles.adaniLogoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandSubtitle}>Smart Meter Workforce Portal</Text>
          <View style={styles.portalTagWrap}>
            <Text style={styles.portalTag}>GPS WORKFORCE & ATTENDANCE PLATFORM</Text>
          </View>
        </View>

        {/* Clean, Modern Login Card */}
        <View style={[styles.loginCard, SHADOWS.md]}>
          <Text style={styles.cardHeader}>Sign In to Account</Text>
          <Text style={styles.cardSub}>
            Enter your employee credentials to access field operations
          </Text>

          {/* Form Error Banner (with server configure trigger if network error) */}
          {formError ? (
            <View style={styles.errorBox}>
              <AlertTriangle size={16} color={COLORS.dangerDark} style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorText}>{formError}</Text>
                {formError.includes('Network Error') ? (
                  <TouchableOpacity delayPressIn={0}
                    style={styles.fixServerBtn}
                    onPress={() => setShowServerModal(true)}
                    activeOpacity={0.8}
                  >
                    <Settings2 size={13} color="#991B1B" />
                    <Text style={styles.fixServerText}>Configure Server IP / Test Ping</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Employee ID Input */}
          <AppInput
            label="Employee ID or Mobile Number"
            placeholder="e.g. b4S/Adani/01 or 9876543210"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setFormError(null);
            }}
            autoCapitalize="none"
            icon={<UserIcon size={18} color={COLORS.textSecondary} />}
          />

          {/* Password Input */}
          <AppInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setFormError(null);
            }}
            isPassword
            icon={<Lock size={18} color={COLORS.textSecondary} />}
          />

          {/* Options Row: Remember Me & Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity delayPressIn={0}
              style={styles.checkboxContainer}
              activeOpacity={0.7}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View
                style={[
                  styles.checkbox,
                  rememberMe && styles.checkboxChecked,
                ]}
              >
                {rememberMe ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.rememberText}>Remember Me</Text>
            </TouchableOpacity>

            <TouchableOpacity delayPressIn={0}
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Primary Action Button */}
          <AppButton
            title="Sign In to Operations Portal"
            onPress={handleLogin}
            loading={isLoading}
            size="lg"
            style={styles.submitBtn}
          />
        </View>

        {/* Development Quick Role Switcher */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>DEVELOPMENT DEMO CREDENTIALS</Text>
          <View style={styles.demoButtonRow}>
            <TouchableOpacity delayPressIn={0}
              style={[
                styles.demoPill,
                username === 'b4S/Adani/01' && styles.demoPillActive,
              ]}
              onPress={() => fillDemo('b4S/Adani/01')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.demoPillText,
                  username === 'b4S/Adani/01' && styles.demoPillTextActive,
                ]}
              >
                Technician
              </Text>
            </TouchableOpacity>

            <TouchableOpacity delayPressIn={0}
              style={[
                styles.demoPill,
                (username === 'SUPER01' || username === 'supervisor' || username === 'b4S/Adani/04' || username === 'b4S/Adani/05') && styles.demoPillActive,
              ]}
              onPress={() => fillDemo('SUPER01')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.demoPillText,
                  (username === 'SUPER01' || username === 'supervisor' || username === 'b4S/Adani/04' || username === 'b4S/Adani/05') && styles.demoPillTextActive,
                ]}
              >
                Supervisor
              </Text>
            </TouchableOpacity>

            <TouchableOpacity delayPressIn={0}
              style={[
                styles.demoPill,
                (username === 'admin' || username === 'b4S/Adani/Admin') && styles.demoPillActive,
              ]}
              onPress={() => fillDemo('admin')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.demoPillText,
                  (username === 'admin' || username === 'b4S/Adani/Admin') && styles.demoPillTextActive,
                ]}
              >
                Operations Admin
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security & Copyright Footer */}
        <View style={styles.footerWrap}>
          <View style={styles.securityRow}>
            <ShieldCheck size={13} color="#64748B" style={{ marginRight: 5 }} />
            <Text style={styles.securityText}>Secured 256-bit TLS Enterprise Authentication</Text>
          </View>
          <Text style={styles.copyrightText}>
            © 2026 Adani Group • High Voltage Grid & Smart Meter Workforce System
          </Text>
        </View>

        {/* Server Endpoint Configuration Modal (Available when needed) */}
        <Modal visible={showServerModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, SHADOWS.lg]}>
              <Text style={styles.modalTitle}>Backend Server Configuration</Text>
              <Text style={styles.modalSub}>
                Select or enter the IP address of your host machine running the FastAPI backend.
              </Text>

              <AppInput
                label="API Base URL"
                value={serverUrl}
                onChangeText={(t) => {
                  setServerUrl(t);
                  setConnectionStatus(null);
                }}
                autoCapitalize="none"
              />

              <Text style={styles.quickPresetTitle}>QUICK PRESETS</Text>
              <View style={styles.presetCol}>
                <TouchableOpacity delayPressIn={0}
                  style={styles.presetBtn}
                  onPress={() => {
                    setServerUrl('http://192.168.0.111:8000');
                    handleTestConnection('http://192.168.0.111:8000');
                  }}
                >
                  <Text style={styles.presetBtnTitle}>Current LAN IP (Wi-Fi Physical Phone)</Text>
                  <Text style={styles.presetBtnSub}>http://192.168.0.111:8000</Text>
                </TouchableOpacity>

                <TouchableOpacity delayPressIn={0}
                  style={styles.presetBtn}
                  onPress={() => {
                    setServerUrl('http://127.0.0.1:8000');
                    handleTestConnection('http://127.0.0.1:8000');
                  }}
                >
                  <Text style={styles.presetBtnTitle}>Localhost (Web Browser / iOS Simulator)</Text>
                  <Text style={styles.presetBtnSub}>http://127.0.0.1:8000</Text>
                </TouchableOpacity>

                <TouchableOpacity delayPressIn={0}
                  style={styles.presetBtn}
                  onPress={() => {
                    setServerUrl('http://10.0.2.2:8000');
                    handleTestConnection('http://10.0.2.2:8000');
                  }}
                >
                  <Text style={styles.presetBtnTitle}>Android Emulator Host Bridge</Text>
                  <Text style={styles.presetBtnSub}>http://10.0.2.2:8000</Text>
                </TouchableOpacity>
              </View>

              {connectionStatus ? (
                <View
                  style={[
                    styles.connStatusBox,
                    connectionStatus.includes('success')
                      ? styles.connStatusSuccess
                      : styles.connStatusFail,
                  ]}
                >
                  <Text style={styles.connStatusText}>{connectionStatus}</Text>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <AppButton
                  title="Test Ping"
                  onPress={() => handleTestConnection()}
                  variant="outline"
                  loading={testingConnection}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="Apply & Close"
                  onPress={() => {
                    setApiBaseUrl(serverUrl.trim().replace(/\/+$/, ''));
                    setShowServerModal(false);
                  }}
                  variant="primary"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  topLogoHeader: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  logoCardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  adaniLogoImage: {
    width: 200,
    height: 90,
  },
  brandSubtitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  portalTagWrap: {
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  portalTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.8,
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  cardSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  fixServerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FECACA',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 8,
    gap: 5,
  },
  fixServerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#1E63F0',
    borderColor: '#1E63F0',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 13,
    color: '#1E63F0',
    fontWeight: '700',
  },
  submitBtn: {
    marginTop: 4,
  },
  demoSection: {
    marginTop: 22,
    alignItems: 'center',
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  demoButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  demoPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  demoPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1E63F0',
  },
  demoPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  demoPillTextActive: {
    color: '#1E63F0',
    fontWeight: '800',
  },
  footerWrap: {
    marginTop: 22,
    alignItems: 'center',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  copyrightText: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 16,
  },
  quickPresetTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  presetCol: {
    gap: 8,
    marginBottom: 14,
  },
  presetBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetBtnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  presetBtnSub: {
    fontSize: 11,
    color: '#1E63F0',
    marginTop: 2,
  },
  connStatusBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  connStatusSuccess: {
    backgroundColor: '#DCFCE7',
  },
  connStatusFail: {
    backgroundColor: '#FEE2E2',
  },
  connStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
