enum PayOutcome { paid, cancelled, failed }

class PayResult {
  const PayResult(this.outcome, [this.message]);
  final PayOutcome outcome;
  final String? message;
}
