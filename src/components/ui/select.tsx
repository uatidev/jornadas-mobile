import { Icon } from "@/src/components/ui/icon";
import { THEME } from "@/src/components/ui/lib/theme";
import { cn } from "@/src/components/ui/lib/utils";
import { NativeOnlyAnimatedView } from "@/src/components/ui/native-only-animated-view";
import { Text, TextClassContext } from "@/src/components/ui/text";
import { useTheme } from "@/src/providers/ThemeProvider";
import * as SelectPrimitive from "@rn-primitives/select";
import {
  Check,
  ChevronDown,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react-native";
import * as React from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";

const SelectTrigger = React.forwardRef<
  SelectPrimitive.TriggerRef,
  SelectPrimitive.TriggerProps & {
    children?: React.ReactNode;
    size?: "default" | "sm";
    iconClassName?: string;
  }
>(({ className, children, size = "default", iconClassName, ...props }, ref) => {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "border-input trnasparent bg-card/30 dark:active:bg-card/50 bg-background flex h-10 flex-row items-center justify-between gap-2 rounded-md border px-3 py-2 shadow-sm shadow-black/5 sm:h-9",
        Platform.select({
          web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:hover:bg-input/50 w-fit whitespace-nowrap text-sm outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
        }),
        props.disabled && "opacity-50",
        size === "sm" && "h-8 py-2 sm:py-1.5",
        className
      )}
      {...props}
    >
      <>{children}</>
      <Icon
        as={ChevronDown}
        aria-hidden={true}
        className={cn("text-muted-foreground size-4", iconClassName)}
      />
    </SelectPrimitive.Trigger>
  );
});

SelectTrigger.displayName = "SelectTrigger";

type Option = SelectPrimitive.Option;

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

function SelectValue({
  ref,
  className,
  ...props
}: SelectPrimitive.ValueProps &
  React.RefAttributes<SelectPrimitive.ValueRef> & {
    className?: string;
  }) {
  const { value } = SelectPrimitive.useRootContext();
  return (
    <SelectPrimitive.Value
      ref={ref}
      className={cn(
        "text-foreground line-clamp-1 flex flex-row items-center gap-2 text-sm",
        !value && "text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

const FullWindowOverlay =
  Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

function SelectContent({
  className,
  children,
  position = "popper",
  portalHost,
  insets,
  ...props
}: SelectPrimitive.ContentProps &
  React.RefAttributes<SelectPrimitive.ContentRef> & {
    className?: string;
    portalHost?: string;
    insets?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
  }) {
  const { colorScheme } = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const backgroundColor = THEME[colorScheme].background;
  const borderColor = THEME[colorScheme].border;
  const context = SelectPrimitive.useRootContext();

  const handleClose = () => {
    context.onOpenChange?.(false);
  };

  // En móvil, usar Actionsheet style
  if (Platform.OS !== "web") {
    return (
      <Modal
        visible={context.open}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
        hardwareAccelerated
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0, 0, 0, 0.5)" },
            ]}
          />
        </TouchableWithoutFeedback>
        <Animated.View
          entering={SlideInDown.springify().stiffness(1000)}
          exiting={SlideOutDown.springify().stiffness(1000)}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor,
            maxHeight: "80%",
            paddingBottom: (insets?.bottom ?? safeAreaInsets.bottom) + 16,
          }}
        >
          {/* Handle bar */}
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: borderColor,
              borderRadius: 2,
              alignSelf: "center",
              marginTop: 12,
              marginBottom: 8,
            }}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <TextClassContext.Provider value="text-popover-foreground">
              {children}
            </TextClassContext.Provider>
          </ScrollView>
        </Animated.View>
      </Modal>
    );
  }

  // En web, mantener el comportamiento original
  return (
    <SelectPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <SelectPrimitive.Overlay
          style={Platform.select({ native: StyleSheet.absoluteFill })}
        >
          <TextClassContext.Provider value="text-popover-foreground">
            <NativeOnlyAnimatedView
              className="z-50"
              entering={FadeIn}
              exiting={FadeOut}
            >
              <SelectPrimitive.Content
                className={cn(
                  "bg-popover border-border relative z-50 min-w-[8rem] rounded-md border shadow-md shadow-black/5",
                  Platform.select({
                    web: cn(
                      "animate-in fade-in-0 zoom-in-95 origin-(--radix-select-content-transform-origin) max-h-52 overflow-y-auto overflow-x-hidden",
                      props.side === "bottom" && "slide-in-from-top-2",
                      props.side === "top" && "slide-in-from-bottom-2"
                    ),
                    native: "p-1",
                  }),
                  position === "popper" &&
                  Platform.select({
                    web: cn(
                      props.side === "bottom" && "translate-y-1",
                      props.side === "top" && "-translate-y-1"
                    ),
                  }),
                  className
                )}
                position={position}
                {...props}
              >
                <SelectScrollUpButton />
                <SelectPrimitive.Viewport
                  className={cn(
                    "p-1",
                    position === "popper" &&
                    cn(
                      "w-full",
                      Platform.select({
                        web: "h-[var(--radix-select-trigger-height)] min-w-[var(--radix-select-trigger-width)]",
                      })
                    )
                  )}
                >
                  {children}
                </SelectPrimitive.Viewport>
                <SelectScrollDownButton />
              </SelectPrimitive.Content>
            </NativeOnlyAnimatedView>
          </TextClassContext.Provider>
        </SelectPrimitive.Overlay>
      </FullWindowOverlay>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.LabelProps & React.RefAttributes<SelectPrimitive.LabelRef>) {
  return (
    <SelectPrimitive.Label
      className={cn(
        "text-muted-foreground px-2 py-2 text-xs sm:py-1.5",
        className
      )}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  label,
  ...props
}: SelectPrimitive.ItemProps &
  React.RefAttributes<SelectPrimitive.ItemRef> & {
    label?: string;
  }) {
  const { colorScheme } = useTheme();
  const borderColor = THEME[colorScheme].border;
  const foregroundColor = THEME[colorScheme].foreground;

  // Extraer label de props si existe
  const itemLabel = label || (props as any).label || "";

  return (
    <SelectPrimitive.Item
      className={cn(
        "active:bg-accent group relative flex w-full flex-row items-center gap-2 rounded-sm py-2 pl-2 pr-8 sm:py-1.5",
        Platform.select({
          web: "focus:bg-accent focus:text-accent-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 cursor-default outline-none data-[disabled]:pointer-events-none [&_svg]:pointer-events-none",
          native: "border-b border-border",
        }),
        props.disabled && "opacity-50",
        className
      )}
      style={Platform.select({
        native: {
          paddingVertical: 16,
          paddingHorizontal: 16,
          // borderBottomWidth: 1,
          // borderBottomColor: borderColor,
        },
      })}
      label={itemLabel}
      {...props}
    >
      <View className="flex-1">
        {React.isValidElement(children) ? (
          React.cloneElement(children as React.ReactElement<any>, {
            className: cn(
              "text-foreground group-active:text-accent-foreground select-none text-base",
              (children as React.ReactElement<any>).props?.className
            ),
            style: Platform.select({
              native: { color: foregroundColor },
            }),
          })
        ) : Platform.OS === "web" ? (
          <SelectPrimitive.ItemText className="text-foreground group-active:text-accent-foreground select-none text-base" />
        ) : (
          <Text className="text-base" style={{ color: foregroundColor }}>
            {itemLabel || (typeof children === "string" ? children : "")}
          </Text>
        )}
      </View>
      <View className="absolute right-4 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Icon as={Check} className="text-primary size-4 shrink-0" />
        </SelectPrimitive.ItemIndicator>
      </View>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.SeparatorProps &
  React.RefAttributes<SelectPrimitive.SeparatorRef>) {
  return (
    <SelectPrimitive.Separator
      className={cn(
        "bg-border -mx-1 my-1 h-px",
        Platform.select({ web: "pointer-events-none" }),
        className
      )}
      {...props}
    />
  );
}

/**
 * @platform Web only
 * Returns null on native platforms
 */
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  if (Platform.OS !== "web") {
    return null;
  }
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <Icon as={ChevronUpIcon} className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

/**
 * @platform Web only
 * Returns null on native platforms
 */
function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  if (Platform.OS !== "web") {
    return null;
  }
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <Icon as={ChevronDownIcon} className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

/**
 * @platform Native only
 * Returns the children on the web
 */
function NativeSelectScrollView({
  className,
  ...props
}: React.ComponentProps<typeof ScrollView>) {
  if (Platform.OS === "web") {
    return <>{props.children}</>;
  }
  return <ScrollView className={cn("max-h-52", className)} {...props} />;
}

export {
  NativeSelectScrollView,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type Option
};

