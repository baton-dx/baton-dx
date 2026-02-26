class BatonDx < Formula
  desc "CLI package manager for Developer Experience & AI configuration"
  homepage "https://github.com/baton-dx/baton-dx"
  url "https://registry.npmjs.org/@baton-dx/cli/-/cli-0.13.0.tgz"
  sha256 "453fd2d968c1a4c9e05e75a99c5853de77bc2dca048eb4dfe959536ca772f2f6"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/baton --version")
  end
end
