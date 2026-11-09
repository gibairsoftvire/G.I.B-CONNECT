#!/usr/bin/env python3
"""V15: simulation locale, aucune connexion Firebase, aucun e-mail ni suspension."""
import json, sys
from datetime import date, timedelta

CONFIRMED={"Authorized","Captured","Paid","Succeeded"}
def assess(member, today):
    if member.get("role") in ("owner","admin","moderator"):
        return {"status":"exempt_role","red":False,"email_j15":False,"restrict_j30":False}
    if member.get("excluded"):
        return {"status":"excluded_separately","red":False,"email_j15":False,"restrict_j30":False}
    c=member.get("membership") or {}
    if c.get("method")=="exempt":
        return {"status":"exempt","red":False,"email_j15":False,"restrict_j30":False}
    states=member.get("helloasso_states") or {}
    if any(int(states.get(k,0))>0 for k in CONFIRMED):
        return {"status":"payment_detected_period_to_verify","red":False,"email_j15":False,"restrict_j30":False}
    end=c.get("end")
    if not end:
        return {"status":"missing_end_date","red":True,"email_j15":False,"restrict_j30":False}
    try: expiry=date.fromisoformat(end)
    except ValueError:
        return {"status":"invalid_end_date","red":True,"email_j15":False,"restrict_j30":False}
    if expiry>=today:
        return {"status":"current","red":False,"email_j15":False,"restrict_j30":False}
    days=(today-expiry).days
    # Without verified per-installment records, monthly restriction is NOT safe.
    annual=c.get("period")=="annuelle"
    monthly_verified=bool(member.get("two_due_installments_verified_unpaid"))
    # No automatic sanction if the reconciliation is missing or ambiguous.
    verified=bool(member.get("nonpayment_verified"))
    return {"status":"expired_unpaid_to_verify" if not verified else "expired_verified_unpaid",
            "red":True,"days_overdue":days,
            "email_j15":verified and days>=15,
            "restrict_j30":verified and days>=30 and (annual or monthly_verified)}
def main():
    if len(sys.argv)!=2:
        raise SystemExit("Utilisation : python gib_cotisations_v15_simulation.py membres_test.json")
    data=json.load(open(sys.argv[1],encoding="utf-8"))
    today=date.fromisoformat(data.get("today",date.today().isoformat()))
    print(json.dumps([{"id":m["id"],**assess(m,today)} for m in data["members"]],
                     ensure_ascii=False,indent=2))
if __name__=="__main__": main()
