import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { COLORS, RADII, SHADOWS } from '../../constants/theme';
import { AppButton } from './AppButton';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmTitle?: string;
  cancelTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: 'danger' | 'primary' | 'warning';
  children?: React.ReactNode;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmTitle = 'Confirm',
  cancelTitle = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  variant = 'primary',
  children,
}) => {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalCard, SHADOWS.lg]}>
              <View style={styles.header}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor:
                        variant === 'danger'
                          ? '#FEE2E2'
                          : variant === 'warning'
                          ? '#FEF3C7'
                          : '#DBEAFE',
                    },
                  ]}
                >
                  <AlertCircle
                    size={24}
                    color={
                      variant === 'danger'
                        ? COLORS.danger
                        : variant === 'warning'
                        ? COLORS.warning
                        : COLORS.primary
                    }
                  />
                </View>
                <Text style={styles.title}>{title}</Text>
              </View>

              {message ? <Text style={styles.message}>{message}</Text> : null}

              {children ? <View style={styles.customContent}>{children}</View> : null}

              <View style={styles.buttonRow}>
                <AppButton
                  title={cancelTitle}
                  onPress={onCancel}
                  variant="outline"
                  size="md"
                  disabled={loading}
                  style={styles.cancelBtn}
                />
                <AppButton
                  title={confirmTitle}
                  onPress={onConfirm}
                  variant={variant === 'danger' ? 'danger' : 'primary'}
                  size="md"
                  loading={loading}
                  style={styles.confirmBtn}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.card,
    borderRadius: RADII.card,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  customContent: {
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
  },
  confirmBtn: {
    flex: 1,
  },
});
