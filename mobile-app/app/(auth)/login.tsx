import React, { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Mail, Lock } from 'lucide-react-native';
import { supabase } from '../../src/api/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import { getErrorMessage } from '../../src/utils/error';
import { GlassCard, GlassText, Input, Button } from '../../src/components/ui';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.login.missingFields'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) setAuth(data.session);
    } catch (error) {
      Alert.alert(t('auth.login.failed'), getErrorMessage(error) || t('common.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(t('auth.forgotTitle'), t('auth.forgotNeedEmail'));
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert(t('auth.forgotSentTitle'), t('auth.forgotSentMsg'));
    } catch (error) {
      Alert.alert(t('common.error'), getErrorMessage(error) || t('common.somethingWrong'));
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          className="px-6 py-12"
        >
          <View className="mb-8 items-center">
            <Image
              source={require('../../assets/easy-split-logo.png')}
              style={{ width: 128, height: 128, borderRadius: 100 }}
              resizeMode="contain"
            />
          </View>

          <View className="mb-10 items-center">
            <GlassText variant="h1" className="mb-2">
              {t('auth.login.welcomeBack')}
            </GlassText>
            <GlassText variant="body" className="px-4 text-center text-content-muted">
              {t('auth.login.subtitle')}
            </GlassText>
          </View>

          <GlassCard intensity={30} className="mb-8" padding="p-6">
            <View className="gap-6">
              <Input
                label={t('auth.emailLabel')}
                icon={Mail}
                placeholder="email@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Input
                label={t('auth.passwordLabel')}
                labelAccessory={
                  <TouchableOpacity onPress={handleForgotPassword}>
                    <GlassText variant="caption" className="font-outfit-bold lowercase text-accent">
                      {t('auth.forgot')}
                    </GlassText>
                  </TouchableOpacity>
                }
                icon={Lock}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureToggle
              />
            </View>
          </GlassCard>

          <Button
            title={t('auth.login.button')}
            onPress={handleLogin}
            loading={loading}
            className="mb-8"
          />

          <View className="mt-auto flex-row justify-center py-6">
            <GlassText variant="body" className="text-content-muted">
              {t('auth.login.noAccount')}
            </GlassText>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <GlassText variant="body" className="font-outfit-bold text-accent">
                {t('auth.login.createAccount')}
              </GlassText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
