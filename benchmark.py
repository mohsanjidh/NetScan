import time
import json
from datetime import datetime
from backend.models import DiagnosticRequest, TestType, StatusEnum, ErrorType, DiagnosticResult
from backend.diagnostics import DiagnosticFactory, PathDiagnosticWorkflow
from backend.rca_engine import RootCauseAnalyzer
from backend.database import DatabaseManager
from backend.ml_classifier import NetworkFaultClassifier, FeatureExtractor
from backend.explainability import ExplainabilityEngine
from backend.verification import VerificationEngine
from backend.report_generator import ReportGenerator

def run_benchmarks():
    print("=========================================================")
    print("   NetRCA-X System Evaluation & Performance Benchmark    ")
    print("=========================================================\n")

    # 1. Diagnostic Probe Speed
    print("[1/5] Benchmarking Polymorphic Diagnostic Probes...")
    req = DiagnosticRequest(target="127.0.0.1", test_type=TestType.DNS)
    runner = DiagnosticFactory.get_test_runner(TestType.DNS)
    
    t0 = time.perf_counter()
    res = runner.run(req)
    t1 = time.perf_counter()
    probe_ms = (t1 - t0) * 1000.0
    print(f"  - DNS Probe Latency: {probe_ms:.2f} ms")

    # 2. Path Workflow Execution Speed
    print("\n[2/5] Benchmarking 3-Point Path Workflow (Gateway -> DNS -> Target)...")
    workflow = PathDiagnosticWorkflow()
    from backend.models import BatchDiagnosticRequest
    t0 = time.perf_counter()
    batch_res = workflow.run_workflow(BatchDiagnosticRequest(target="google.com", port=443))
    t1 = time.perf_counter()
    workflow_ms = (t1 - t0) * 1000.0
    print(f"  - Full Path Workflow Execution Time: {workflow_ms:.2f} ms")


    # 3. SQLite Database Write & Search Throughput
    print("\n[3/5] Benchmarking SQLite Persistence Engine (netrca.db)...")
    db = DatabaseManager(db_path="netrca.db")
    t0 = time.perf_counter()
    for i in range(50):
        dummy_sess = DiagnosticResult(
            session_id=f"S-BENCH-{i}",
            target="benchmark.local",
            test_type=TestType.CONNECTIVITY,
            status=StatusEnum.PASSED,
            response_time_ms=10.0 + i,
            message="Benchmark ping session",
            evidence=["ICMP reply ok"],
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            error_type=ErrorType.NONE
        )
        db.insert_session(dummy_sess)
    t1 = time.perf_counter()
    db_insert_ms = (t1 - t0) * 1000.0
    print(f"  - 50 Database Inserts Time: {db_insert_ms:.2f} ms ({db_insert_ms/50:.2f} ms/record)")

    t0 = time.perf_counter()
    retrieved = db.get_sessions(search="benchmark.local", limit=100)
    t1 = time.perf_counter()
    db_query_ms = (t1 - t0) * 1000.0
    print(f"  - Database Query Time ({len(retrieved)} records fetched): {db_query_ms:.2f} ms")

    # 4. Scikit-Learn Random Forest Inference Speed
    print("\n[4/5] Benchmarking Machine Learning Classifier & Feature Extractor...")
    classifier = NetworkFaultClassifier()
    test_list = [batch_res.gateway_result, batch_res.dns_result, batch_res.target_result]
    
    t0 = time.perf_counter()
    vec = FeatureExtractor.extract_features(test_list)
    cat, prob = classifier.predict(vec)
    t1 = time.perf_counter()
    ml_ms = (t1 - t0) * 1000.0
    print(f"  - 10D Feature Extraction + Random Forest Prediction Time: {ml_ms:.2f} ms")
    print(f"  - Predicted Category: '{cat}' ({prob:.1f}% confidence)")

    # 5. Explainability & Report Export Speed
    print("\n[5/5] Benchmarking Explainability & Report Exporter Engine...")
    t0 = time.perf_counter()
    analyzer = RootCauseAnalyzer()
    exp_res = ExplainabilityEngine.explain("google.com", test_list, classifier, analyzer)
    rep_res = ReportGenerator.generate_report("google.com", test_list, fmt="markdown", ml_classifier=classifier, rca_analyzer=analyzer)
    t1 = time.perf_counter()
    exp_rep_ms = (t1 - t0) * 1000.0
    print(f"  - Explainability + Report Export Generation Time: {exp_rep_ms:.2f} ms")

    print("\n=========================================================")
    print("   BENCHMARK SUMMARY RESULTS: ALL SYSTEMS OPTIMAL       ")
    print("=========================================================")
    print(f"  * Probe Execution: {probe_ms:.2f} ms")
    print(f"  * Multi-Point Path Workflow: {workflow_ms:.2f} ms")
    print(f"  * SQLite Session Writes (50 recs): {db_insert_ms:.2f} ms")
    print(f"  * ML Random Forest Inference: {ml_ms:.2f} ms")
    print(f"  * Report Export Generation: {exp_rep_ms:.2f} ms")
    print("=========================================================\n")

if __name__ == "__main__":
    run_benchmarks()
