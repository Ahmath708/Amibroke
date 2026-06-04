import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/theme/colors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>💀</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry} activeOpacity={0.7}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emoji: { fontSize: 48 },
  title: {
    fontFamily: Typography.fonts.heading, fontSize: Typography.title2.fontSize,
    fontWeight: '700', color: Colors.textPrimary, textAlign: 'center',
  },
  message: {
    fontFamily: Typography.fonts.body, fontSize: Typography.subhead.fontSize,
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 22,
  },
  button: {
    backgroundColor: Colors.accent, paddingVertical: Spacing.md,
    paddingHorizontal: 32, borderRadius: Radius.lg, marginTop: Spacing.md,
  },
  buttonText: {
    fontFamily: Typography.fonts.bodySemi, fontSize: Typography.callout.fontSize,
    color: Colors.background, fontWeight: '600',
  },
});
