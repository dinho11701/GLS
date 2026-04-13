import { useStripe } from "@stripe/stripe-react-native";
import PaymentInnerBase from "./paymentInnerBase";

export default function PaymentInner() {
  const stripe = useStripe();
  return <PaymentInnerBase stripe={stripe} />;
}