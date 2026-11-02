import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';

export interface AppBackButtonProps {
  onPress?: () => void;
  fallbackScreen?: string;
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: number;
}

export const AppBackButton: React.FC<AppBackButtonProps> = ({
  onPress,
  fallbackScreen,
  style,
  color = '#0F172A',
  size = 18,
}) => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (fallbackScreen) {
      navigation.navigate(fallbackScreen);
    } else {
      if (user?.role === 'admin') {
        navigation.navigate('AdminDashboard');
      } else if (user?.role === 'supervisor') {
        navigation.navigate('SupervisorDashboard');
      } else {
        navigation.navigate('Dashboard');
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.backBtn, style]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Back"
      delayPressIn={0}
    >
      <ArrowLeft size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
