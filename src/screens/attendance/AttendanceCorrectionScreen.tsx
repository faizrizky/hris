import { useState } from "react";
import { StyleSheet, Text, ScrollView, TextInput } from "react-native";

import { colors } from "@/theme/colors";
import { hrisApi } from "@/services/api";
import { useSession } from "@/services/session";
import { PrimaryButton } from "@/components/PrimaryButton";

export function AttendanceCorrectionScreen({ navigation }: any) {
  const { employee } = useSession();

  const [date, setDate] = useState("");
  const [requestedCheckIn, setRequestedCheckIn] = useState("");
  const [requestedCheckOut, setRequestedCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (
      !employee ||
      !date ||
      !requestedCheckIn ||
      !requestedCheckOut ||
      !reason
    )
      return;
    setLoading(true);
    try {
      await hrisApi.submitAttendanceCorrection({
        employeeId: employee.id,
        date,
        requestedCheckIn,
        requestedCheckOut,
        reason,
      });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
    >
      <Text style={styles.fieldLabel}>Date</Text>
      <TextInput
        style={[styles.input]}
        value={date}
        onChangeText={setDate}
        placeholder="Date"
      />

      <Text style={styles.fieldLabel}>Requested Check In</Text>
      <TextInput
        style={[styles.input]}
        value={requestedCheckIn}
        onChangeText={setRequestedCheckIn}
        placeholder="Requested Check In"
      />

      <Text style={styles.fieldLabel}>Requested Check Out</Text>
      <TextInput
        style={[styles.input]}
        value={requestedCheckOut}
        onChangeText={setRequestedCheckOut}
        placeholder="Requested Check Out"
      />

      <Text style={styles.fieldLabel}>Reason</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={reason}
        onChangeText={setReason}
        placeholder="Alasan pengajuan"
        multiline
      />

      <PrimaryButton
        label="Kirim Koreksi"
        onPress={handleSubmit}
        loading={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  fieldLabel: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hair,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  textarea: { height: 90, textAlignVertical: "top" },
});
