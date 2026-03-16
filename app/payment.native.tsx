import React from "react";
import { StripeProvider } from "@stripe/stripe-react-native";
import PaymentInner from "./paymentInner.native";

export default function PaymentScreen() {
  return (
    <StripeProvider publishableKey="pk_test_51SHrRqRp5Wost4PH7Ikh9qJPJJ56JavWiD4Qjr4OWE8737exeEs6KnEEKjAKQ8EOTlPl7ZyDkDVCA8u0xdhmbI4v00FFGsEftw">
      <PaymentInner />
    </StripeProvider>
  );
}