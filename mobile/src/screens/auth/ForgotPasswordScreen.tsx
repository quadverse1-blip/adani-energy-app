import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ArrowLeft, KeyRound, CheckCircle } from 'lucide-react-native';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { authService } from '../../services/authService';

interface ForgotPasswordScreenProps {
  navigation: any;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation }) => {
  const [empId, setEmpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!empId.trim()) {
      setError('Please provide your Employee ID');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(empId.trim());
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Employee record not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Password Recovery</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.card, SHADOWS.sm]}>
          <View style={styles.iconCircle}>
            <KeyRound size={28} color={COLORS.primary} />
          </View>

          {success ? (
            <View style={styles.successBox}>
              <CheckCircle size={40} color={COLORS.success} style={{ marginBottom: 12 }} />
              <Text style={styles.successTitle}>Request Submitted</Text>
              <Text style={styles.successMessage}>
                Password reset instructions and a verification code have been dispatched to your
                registered mobile number / company email.
              </Text>
              <AppButton
                title="Back to Sign In"
                onPress={() => navigation.navigate('Login')}
                style={{ marginTop: 20, width: '100%' }}
              />
            </View>
          ) : (
            <>
              <Text style={styles.title}>Reset Field Account</Text>
              <Text style={styles.subtitle}>
                Enter your Adani Employee ID below to verify your identity and receive password
                reset instructions.
              </Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <AppInput
                label="Employee ID"
                placeholder="e.g. b4S/Adani/01"
                value={empId}
                onChangeText={(t) => {
                  setEmpId(t);
                  setError(null);
                }}
                autoCapitalize="characters"
              />

              <AppButton
                title="Send Reset Instructions"
                onPress={handleSubmit}
                loading={loading}
                size="lg"
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 6,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  content: {
    padding: 24,
    justifyContent: 'center',
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: RADII.sm,
    padding: 10,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: COLORS.dangerDark,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  successBox: {
    alignItems: 'center',
    width: '100%',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
