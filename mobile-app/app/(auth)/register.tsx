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
import { User, Mail, Lock, ArrowLeft } from 'lucide-react-native';
import { supabase } from '../../src/api/supabase';
import { getErrorMessage } from '../../src/utils/error';
import { GlassCard, GlassText, Input, Button, IconButton } from '../../src/components/ui';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert(t('common.error'), t('auth.register.missingFields'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error) throw error;

      if (data.user) {
        if (data.session) {
          router.replace('/(tabs)');
        } else {
          Alert.alert(t('auth.register.successTitle'), t('auth.register.successMessage'), [
            { text: t('common.ok'), onPress: () => router.push('/(auth)/login') },
          ]);
        }
      }
    } catch (error) {
      Alert.alert(t('auth.register.failed'), getErrorMessage(error) || t('common.somethingWrong'));
    } finally {
      setLoading(false);
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
          className="px-6 py-8"
        >
          <IconButton
            icon={ArrowLeft}
            onPress={() => router.back()}
            iconSize={22}
            className="mb-6 h-12 w-12 rounded-2xl"
          />

          <View className="mb-6 items-center">
            <Image
              source={require('../../assets/easy-split-logo.png')}
              style={{ width: 128, height: 128, borderRadius: 100 }}
              resizeMode="contain"
            />
          </View>

          <View className="mb-8 items-center">
            <GlassText variant="h1" className="mb-2">
              {t('auth.register.title')}
            </GlassText>
            <GlassText variant="body" className="px-4 text-center text-content-muted">
              {t('auth.register.subtitle')}
            </GlassText>
          </View>

          <GlassCard intensity={30} className="mb-8" padding="p-6">
            <View className="gap-5">
              <Input
                label={t('auth.fullNameLabel')}
                icon={User}
                placeholder={t('auth.fullNamePlaceholder')}
                value={fullName}
                onChangeText={setFullName}
              />
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
                icon={Lock}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureToggle
              />
            </View>
          </GlassCard>

          <Button
            title={t('auth.register.button')}
            onPress={handleRegister}
            loading={loading}
            className="mb-8"
          />

          <View className="mb-10 flex-row justify-center">
            <GlassText variant="body" className="text-content-muted">
              {t('auth.register.haveAccount')}
            </GlassText>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <GlassText variant="body" className="font-outfit-bold text-accent">
                {t('auth.register.signIn')}
              </GlassText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
