import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  KeyRound,
  CheckCircle,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  RotateCcw,
  Lock,
} from 'lucide-react-native';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { authService } from '../../services/authService';
import { AppBackButton } from '../../components/common/AppBackButton';

interface ForgotPasswordScreenProps {
  navigation: any;
}

type Step = 'REQUEST_OTP' | 'VERIFY_OTP' | 'SET_PASSWORD' | 'SUCCESS';

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const [step, setStep] = useState<Step>('REQUEST_OTP');
  const [identifier, setIdentifier] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomEmail, setShowCustomEmail] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatchedEmail, setDispatchedEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Resend Countdown Timer
  useEffect(() => {
    let timer: any;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendTimer]);

  // STEP 1: Request OTP
  const handleRequestOtp = async () => {
    if (!identifier.trim()) {
      setError('Please enter your Employee ID, Phone, or Registered Email');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await authService.forgotPassword(
        identifier.trim(),
        showCustomEmail && customEmail.trim() ? customEmail.trim() : undefined
      );
      setDispatchedEmail(res.email || customEmail.trim() || 'your email');
      setResendTimer(30);
      setStep('VERIFY_OTP');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Unable to dispatch verification code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.trim().length < 4) {
      setError('Please enter the 6-digit verification code sent to your email');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authService.verifyOtp(identifier.trim(), otp.trim());
      setStep('SET_PASSWORD');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Invalid or expired verification code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authService.forgotPassword(
        identifier.trim(),
        showCustomEmail && customEmail.trim() ? customEmail.trim() : undefined
      );
      setDispatchedEmail(res.email || customEmail.trim() || dispatchedEmail);
      setResendTimer(30);
      setError(null);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to resend OTP';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setError('Please enter your new password');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must contain at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await authService.resetPassword(identifier.trim(), otp.trim(), newPassword);
      setStep('SUCCESS');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <AppBackButton
          onPress={() => {
            if (step === 'VERIFY_OTP') setStep('REQUEST_OTP');
            else if (step === 'SET_PASSWORD') setStep('VERIFY_OTP');
            else navigation.goBack();
          }}
        />
        <Text style={styles.headerTitle}>Password Recovery</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, SHADOWS.sm]}>
          {/* Top Brand Circle */}
          <View style={styles.iconCircle}>
            {step === 'SUCCESS' ? (
              <CheckCircle size={32} color={COLORS.success} />
            ) : step === 'SET_PASSWORD' ? (
              <Lock size={28} color={COLORS.primary} />
            ) : step === 'VERIFY_OTP' ? (
              <ShieldCheck size={28} color={COLORS.primary} />
            ) : (
              <KeyRound size={28} color={COLORS.primary} />
            )}
          </View>

          {/* Error Message Box */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ============================================================ */}
          {/* STEP 1: REQUEST OTP                                          */}
          {/* ============================================================ */}
          {step === 'REQUEST_OTP' && (
            <View style={styles.formContainer}>
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter your Adani Employee ID or Registered Email to receive an OTP verification code.
              </Text>

              <AppInput
                label="Employee ID or Email *"
                placeholder="e.g. b4S/Adani/01 or email@domain.com"
                value={identifier}
                onChangeText={(t) => {
                  setIdentifier(t);
                  setError(null);
                }}
                autoCapitalize="none"
              />

              {showCustomEmail ? (
                <View style={{ marginTop: 6 }}>
                  <AppInput
                    label="Send OTP to specific Email"
                    placeholder="e.g. aeslbs8@gmail.com"
                    value={customEmail}
                    onChangeText={(t) => {
                      setCustomEmail(t);
                      setError(null);
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              ) : (
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => setShowCustomEmail(true)}
                  style={styles.toggleCustomEmailBtn}
                  activeOpacity={0.7}
                >
                  <Mail size={14} color={COLORS.primary} />
                  <Text style={styles.toggleCustomEmailText}>
                    Send OTP to a specific email address (Optional)
                  </Text>
                </TouchableOpacity>
              )}

              <AppButton
                title="Send Verification Code"
                onPress={handleRequestOtp}
                loading={loading}
                size="lg"
                style={{ marginTop: 14 }}
              />

              <TouchableOpacity
                delayPressIn={0}
                onPress={() => navigation.navigate('Login')}
                style={styles.cancelLink}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelLinkText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ============================================================ */}
          {/* STEP 2: VERIFY OTP                                           */}
          {/* ============================================================ */}
          {step === 'VERIFY_OTP' && (
            <View style={styles.formContainer}>
              <Text style={styles.title}>Enter 6-Digit OTP</Text>
              <Text style={styles.subtitle}>
                We sent a verification code to{' '}
                <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>
                  {dispatchedEmail}
                </Text>
                . Please enter it below.
              </Text>

              <AppInput
                label="Verification Code (OTP) *"
                placeholder="6-digit code (e.g. 583921)"
                value={otp}
                onChangeText={(t) => {
                  setOtp(t);
                  setError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.otpInput}
              />

              <View style={styles.resendRow}>
                {resendTimer > 0 ? (
                  <Text style={styles.timerText}>
                    Resend OTP in <Text style={{ fontWeight: '700' }}>{resendTimer}s</Text>
                  </Text>
                ) : (
                  <TouchableOpacity
                    delayPressIn={0}
                    onPress={handleResendOtp}
                    activeOpacity={0.7}
                    style={styles.resendBtn}
                  >
                    <RotateCcw size={14} color={COLORS.primary} />
                    <Text style={styles.resendBtnText}>Resend Code</Text>
                  </TouchableOpacity>
                )}
              </View>

              <AppButton
                title="Verify OTP Code"
                onPress={handleVerifyOtp}
                loading={loading}
                size="lg"
                style={{ marginTop: 16 }}
              />

              <TouchableOpacity
                delayPressIn={0}
                onPress={() => setStep('REQUEST_OTP')}
                style={styles.cancelLink}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelLinkText}>Change Employee ID / Email</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ============================================================ */}
          {/* STEP 3: SET NEW PASSWORD                                     */}
          {/* ============================================================ */}
          {step === 'SET_PASSWORD' && (
            <View style={styles.formContainer}>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.subtitle}>
                OTP verified! Create a strong password for your Adani Field Operations account.
              </Text>

              <View style={styles.passwordInputContainer}>
                <AppInput
                  label="New Password *"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  delayPressIn={0}
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIconBtn}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={COLORS.textSecondary} />
                  ) : (
                    <Eye size={18} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>

              <AppInput
                label="Confirm New Password *"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
              />

              <AppButton
                title="Reset Password"
                onPress={handleResetPassword}
                loading={loading}
                size="lg"
                style={{ marginTop: 16 }}
              />
            </View>
          )}

          {/* ============================================================ */}
          {/* STEP 4: SUCCESS                                              */}
          {/* ============================================================ */}
          {step === 'SUCCESS' && (
            <View style={styles.successBox}>
              <Text style={styles.successTitle}>Password Reset Successful!</Text>
              <Text style={styles.successMessage}>
                Your password has been updated. You can now log into your Adani Field Workforce account with your new credentials.
              </Text>

              <AppButton
                title="Proceed to Sign In"
                onPress={() => navigation.navigate('Login')}
                size="lg"
                style={{ marginTop: 24, width: '100%' }}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'center',
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.card || 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  formContainer: {
    width: '100%',
  },
  otpInput: {
    letterSpacing: 4,
    fontWeight: '700',
  },
  toggleCustomEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
  },
  toggleCustomEmailText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  timerText: {
    fontSize: 13,
    color: '#64748B',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  resendBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },
  passwordInputContainer: {
    position: 'relative',
    width: '100%',
  },
  eyeIconBtn: {
    position: 'absolute',
    right: 14,
    top: 38,
    padding: 4,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 16,
    padding: 6,
  },
  cancelLinkText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  successBox: {
    alignItems: 'center',
    width: '100%',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
