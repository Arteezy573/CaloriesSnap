import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, shadow } from "../../theme";

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const showToast = useCallback(
    (msg: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setMessage(null)
        );
      }, 2200);
    },
    [opacity]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message !== null && (
        <Animated.View pointerEvents="none" style={[styles.toast, { top: insets.top + 8, opacity }]}>
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    ...shadow.card,
    shadowOpacity: 0.15,
    elevation: 6,
  },
  text: { fontSize: 14, fontWeight: "600", color: colors.text },
});
